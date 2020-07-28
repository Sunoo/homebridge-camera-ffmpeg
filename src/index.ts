import {
  API,
  APIEvent,
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  CharacteristicValue,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformAccessoryEvent,
  PlatformConfig
} from 'homebridge';
import ip from 'ip';
import http from 'http';
import mqtt from 'mqtt';
import os from 'os';
import url from 'url';
import { CameraConfig, FfmpegPlatformConfig } from './configTypes';
import { Logger } from './logger';
import { StreamingDelegate } from './streamingDelegate';
const version = require('../package.json').version; // eslint-disable-line @typescript-eslint/no-var-requires

let hap: HAP;
let Accessory: typeof PlatformAccessory;

const PLUGIN_NAME = 'homebridge-camera-ffmpeg';
const PLATFORM_NAME = 'Camera-ffmpeg';

class FfmpegPlatform implements DynamicPlatformPlugin {
  private readonly log: Logger;
  private readonly api: API;
  private readonly config: FfmpegPlatformConfig;
  private readonly cameraConfigs: Map<string, CameraConfig> = new Map(); // configuration for each camera indexed by uuid
  private readonly accessories: Array<PlatformAccessory> = [];

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = new Logger(log);
    this.api = api;
    this.config = config as unknown as FfmpegPlatformConfig;

    // Need a config or plugin will not start
    if (!config) {
      return;
    }

    if (this.config.cameras) {
      // doing some sanity checks and index the camera config by the accessory uuid
      this.config.cameras.forEach((cameraConfig: CameraConfig) => {
        let error = false;

        if (!cameraConfig.name) {
          this.log.error('One of your cameras has no name configured. This camera will be skipped.');
          error = true;
        }
        if (!cameraConfig.videoConfig) {
          this.log.error('The videoConfig section is missing from the config. This camera will be skipped.', cameraConfig.name);
          error = true;
        } else if (!cameraConfig.videoConfig.source) {
          this.log.error('There is no source configured for this camera. This camera will be skipped.', cameraConfig.name);
          error = true;
        } else {
          const sourceArgs = cameraConfig.videoConfig.source.split(/\s+/);
          if (!sourceArgs.includes('-i')) {
            this.log.warn('The source this camera is missing "-i", it is likely misconfigured.', cameraConfig.name);
          }
        }

        if (!error) {
          const uuid = hap.uuid.generate(cameraConfig.name);
          if (this.cameraConfigs.has(uuid)) {
            // Camera names must be unique
            this.log.warn('Multiple cameras are configured with this name. Duplicate cameras will be skipped.', cameraConfig.name);
          } else {
            this.cameraConfigs.set(uuid, cameraConfig);
          }
        }
      });
    }

    if (!this.config.interfaceName) {
      const nics = os.networkInterfaces();
      const publicNics = [];
      for (const [nic, details] of Object.entries(nics)) {
        const find = details?.find((info) => {
          return !ip.isLoopback(info.address) && ip.isPrivate(info.address);
        });
        if (find) {
          publicNics.push(nic);
        }
      }
      if (publicNics.length > 1) {
        this.log.warn('Multiple public network interfaces detected, you should set interfaceName ' +
          'to avoid issues: ' + publicNics.join(', '));
      }
    }

    api.on(APIEvent.DID_FINISH_LAUNCHING, this.didFinishLaunching.bind(this));
  }

  configureAccessory(cameraAccessory: PlatformAccessory): void {
    this.log.info('Configuring accessory...', cameraAccessory.displayName);

    cameraAccessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
      this.log.info('Identify requested.', cameraAccessory.displayName);
    });

    const cameraConfig = this.cameraConfigs.get(cameraAccessory.UUID);

    if (!cameraConfig) {
      this.accessories.push(cameraAccessory);
      return;
    }

    const cameraAccessoryInfo = cameraAccessory.getService(hap.Service.AccessoryInformation);
    if (cameraAccessoryInfo) {
      cameraAccessoryInfo.setCharacteristic(hap.Characteristic.Manufacturer, cameraConfig.manufacturer || 'Homebridge');
      cameraAccessoryInfo.setCharacteristic(hap.Characteristic.Model, cameraConfig.model || 'Camera FFmpeg');
      cameraAccessoryInfo.setCharacteristic(hap.Characteristic.SerialNumber, cameraConfig.serialNumber || 'SerialNumber');
      cameraAccessoryInfo.setCharacteristic(hap.Characteristic.FirmwareRevision, cameraConfig.firmwareRevision || version);
    }

    const motionService = cameraAccessory.getService(hap.Service.MotionSensor);
    const doorbellService = cameraAccessory.getService(hap.Service.Doorbell);
    const doorbellTriggerService = cameraAccessory.getServiceById(hap.Service.Switch, 'DoorbellTrigger');
    const motionTriggerService = cameraAccessory.getServiceById(hap.Service.Switch, 'MotionTrigger');
    const doorbellSwitchService = cameraAccessory.getServiceById(hap.Service.StatelessProgrammableSwitch, 'DoorbellSwitch');

    if (motionService) {
      cameraAccessory.removeService(motionService);
    }
    if (doorbellService) {
      cameraAccessory.removeService(doorbellService);
    }
    if (doorbellTriggerService) {
      cameraAccessory.removeService(doorbellTriggerService);
    }
    if (motionTriggerService) {
      cameraAccessory.removeService(motionTriggerService);
    }
    if (doorbellSwitchService) {
      cameraAccessory.removeService(doorbellSwitchService);
    }

    const timeout = cameraConfig.motionTimeout > 0 ? cameraConfig.motionTimeout : 1;

    if (cameraConfig.doorbell) {
      const doorbellService = new hap.Service.Doorbell(cameraConfig.name + ' Doorbell');
      cameraAccessory.addService(doorbellService);
      if (cameraConfig.switches) {
        const doorbellTriggerService = new hap.Service.Switch(cameraConfig.name + ' Doorbell Trigger', 'DoorbellTrigger');
        doorbellTriggerService
          .getCharacteristic(hap.Characteristic.On)
          .on(CharacteristicEventTypes.SET, (state: CharacteristicValue, callback: CharacteristicSetCallback) => {
            if (state) {
              doorbellService.updateCharacteristic(hap.Characteristic.ProgrammableSwitchEvent,
                hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
              );

              setTimeout(() => {
                doorbellTriggerService.getCharacteristic(hap.Characteristic.On).updateValue(false);
              }, timeout * 1000);
            }
            callback(null, state);
          });
        cameraAccessory.addService(doorbellTriggerService);
      }
    }
    if (cameraConfig.motion) {
      const motionService = new hap.Service.MotionSensor(cameraConfig.name);
      cameraAccessory.addService(motionService);
      const log = this.log;

      if (cameraConfig.switches) {
        const motionTriggerService = new hap.Service.Switch(cameraConfig.name, 'MotionTrigger');
        motionTriggerService
          .getCharacteristic(hap.Characteristic.On)
          .on(CharacteristicEventTypes.SET, (isOn: CharacteristicValue, callback: CharacteristicSetCallback) => {
            log.info('Switch motion detect ' + (isOn ? 'on.' : 'off.'), cameraAccessory.displayName);
            motionService.setCharacteristic(hap.Characteristic.MotionDetected, isOn ? 1 : 0);
            if (isOn) {
              setTimeout(() => {
                const motionTriggerService = cameraAccessory.getServiceById(hap.Service.Switch, 'MotionTrigger');
                if (motionTriggerService) {
                  motionTriggerService.setCharacteristic(hap.Characteristic.On, false);
                }
              }, timeout * 1000);
            }
            callback(null, isOn);
          });
        cameraAccessory.addService(motionTriggerService);
      }
    }

    const streamingDelegate = new StreamingDelegate(this.log, cameraConfig, this.api, hap,
      this.config.videoProcessor, this.config.interfaceName);

    cameraAccessory.configureController(streamingDelegate.controller);

    this.accessories.push(cameraAccessory);
  }

  private doorbellHandler(name: string): void {
    const accessory = this.accessories.find((curAcc: PlatformAccessory) => curAcc.displayName == name);
    if (accessory) {
      this.log.info('Switch doorbell on.', accessory.displayName);
      const doorbell = accessory.getService(hap.Service.Doorbell);
      if (doorbell) {
        doorbell.updateCharacteristic(hap.Characteristic.ProgrammableSwitchEvent,
          hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
      }
    }
  }

  private motionHandler(name: string, active = true): void {
    const accessory = this.accessories.find((curAcc: PlatformAccessory) => curAcc.displayName == name);
    if (accessory) {
      this.log.info('Switch motion detect ' + (active ? 'on.' : 'off.'), accessory.displayName);
      const motionSensor = accessory.getService(hap.Service.MotionSensor);
      if (motionSensor) {
        if (active) {
          motionSensor.setCharacteristic(hap.Characteristic.MotionDetected, 1);
          const timeout = this.cameraConfigs.get(accessory.UUID)?.motionTimeout ?? 1;
          const log = this.log;
          if (timeout > 0) {
            setTimeout(() => {
              log.debug('Motion detect timeout.', accessory.displayName);
              motionSensor.setCharacteristic(hap.Characteristic.MotionDetected, 0);
            }, timeout * 1000);
          }
        } else {
          motionSensor.setCharacteristic(hap.Characteristic.MotionDetected, 0);
        }
      }
    }
  }

  private automationHandler(fullpath: string, name: string): void{
    const path = fullpath.split('/').filter((value) => value.length > 0);
    switch (path[0]) {
      case 'motion':
        this.motionHandler(name, path[1] != 'reset');
        break;
      case 'doorbell':
        this.doorbellHandler(name);
        break;
    }
  }

  didFinishLaunching(): void {
    if (this.config.mqtt) {
      const portmqtt = this.config.portmqtt || '1883';
      let mqtttopic = 'homebridge';
      if (this.config.topic && this.config.topic != 'homebridge/motion') {
        mqtttopic = this.config.topic;
      }
      this.log.info('Setting up MQTT connection with topic ' + mqtttopic + '...');
      const client = mqtt.connect('mqtt://' + this.config.mqtt + ':' + portmqtt, {
        'username': this.config.usermqtt,
        'password': this.config.passmqtt
      });
      client.on('connect', () => {
        this.log.info('MQTT connected.');
        client.subscribe(mqtttopic + '/#');
      });
      client.on('message', (topic: string, message: Buffer) => {
        if (topic.startsWith(mqtttopic)) {
          const path = topic.substr(mqtttopic.length);
          const name = message.toString();
          this.automationHandler(path, name);
        }
      });
    }
    if (this.config.porthttp) {
      this.log.info('Setting up HTTP server on port ' + this.config.porthttp + '...');
      const server = http.createServer();
      const hostname = this.config.localhttp ? 'localhost' : undefined;
      server.listen(this.config.porthttp, hostname);
      server.on('request', (request: http.IncomingMessage, response: http.ServerResponse) => {
        if (request.url) {
          const parseurl = url.parse(request.url);
          if (parseurl.pathname && parseurl.query) {
            const name = decodeURIComponent(parseurl.query);
            this.automationHandler(parseurl.pathname, name);
          }
        }
        response.writeHead(200);
        response.end();
      });
    }

    for (const [uuid, cameraConfig] of this.cameraConfigs) {
      // Only add new cameras that are not cached
      if (!this.accessories.find((x: PlatformAccessory) => x.UUID === uuid)) {
        const cameraAccessory = new Accessory(cameraConfig.name, uuid);
        this.configureAccessory(cameraAccessory); // abusing the configureAccessory here
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [cameraAccessory]);
      }
    }

    // remove all cameras that are configured but are not listed in the config
    this.accessories.forEach((accessory: PlatformAccessory) => {
      if (!this.cameraConfigs.has(accessory.UUID)) {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    });
  }
}

export = (api: API): void => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, FfmpegPlatform);
};