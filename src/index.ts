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
import { StreamingDelegate } from './streamingDelegate';
import { CameraConfig, FfmpegPlatformConfig } from './configTypes';
import mqtt = require('mqtt');
import http = require('http');
import url = require('url');
const version = require('../package.json').version; // eslint-disable-line @typescript-eslint/no-var-requires

let hap: HAP;
let Accessory: typeof PlatformAccessory;

const PLUGIN_NAME = 'homebridge-camera-ffmpeg';
const PLATFORM_NAME = 'Camera-ffmpeg';

class FfmpegPlatform implements DynamicPlatformPlugin {
  private readonly log: Logging;
  private readonly api: API;
  private readonly config: FfmpegPlatformConfig;
  private readonly cameraConfigs: Map<string, CameraConfig> = new Map(); // configuration for each camera indexed by uuid
  private readonly accessories: Array<PlatformAccessory> = [];

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.api = api;
    this.config = config as unknown as FfmpegPlatformConfig;

    // Need a config or plugin will not start
    if (!config) {
      return;
    }

    if (this.config.cameras) {
      // doing some sanity checks and index the camera config by the accessory uuid
      this.config.cameras.forEach((cameraConfig: CameraConfig) => {
        if (!cameraConfig.name || ! cameraConfig.videoConfig) {
          this.log.error('Missing parameters (\'name\' or \'videoConfig\') for camera ' + cameraConfig.name);
          return;
        }

        const uuid = hap.uuid.generate(cameraConfig.name);
        if (this.cameraConfigs.has(uuid)) {
          // Camera names must be unique
          this.log.error(`The camera ${cameraConfig.name} seems to be defined more than one time. Ignoring any other occurrences!`);
          return;
        }

        this.cameraConfigs.set(uuid, cameraConfig);
      });
    }

    api.on(APIEvent.DID_FINISH_LAUNCHING, this.didFinishLaunching.bind(this));
  }

  configureAccessory(cameraAccessory: PlatformAccessory): void {
    this.log(`Configuring accessory ${cameraAccessory.displayName}`);

    cameraAccessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
      this.log(`${cameraAccessory.displayName} identified!`);
    });

    const cameraConfig = this.cameraConfigs.get(cameraAccessory.UUID);

    if (!cameraConfig) {
      this.accessories.push(cameraAccessory);
      return;
    }

    const cameraAccessoryInfo = cameraAccessory.getService(hap.Service.AccessoryInformation);
    if (cameraAccessoryInfo) {
      cameraAccessoryInfo.setCharacteristic(hap.Characteristic.Manufacturer, cameraConfig.manufacturer || 'Default-Manufacturer');
      cameraAccessoryInfo.setCharacteristic(hap.Characteristic.Model, cameraConfig.model || 'Default-Model');
      cameraAccessoryInfo.setCharacteristic(hap.Characteristic.SerialNumber, cameraConfig.serialNumber || 'Default-SerialNumber');
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
      const doorbellService = new hap.Service.Doorbell(`${cameraConfig.name} Doorbell`);
      cameraAccessory.addService(doorbellService);
      if (cameraConfig.switches) {
        const doorbellTriggerService = new hap.Service.Switch(`${cameraConfig.name} Doorbell Trigger`, 'DoorbellTrigger');
        doorbellTriggerService
          .getCharacteristic(hap.Characteristic.On)
          .on(CharacteristicEventTypes.SET, (state: CharacteristicValue, callback: CharacteristicSetCallback) => {
            if (state) {
              const doorbellService = cameraAccessory.getService(hap.Service.Doorbell);
              if (doorbellService) {
                doorbellService.updateCharacteristic(
                  hap.Characteristic.ProgrammableSwitchEvent,
                  hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
                );

                setTimeout(() => {
                  doorbellTriggerService.getCharacteristic(hap.Characteristic.On).updateValue(false);
                }, timeout * 1000);
              }
            }
            callback(null, state);
          });
        cameraAccessory.addService(doorbellTriggerService);
      }

      if (cameraConfig.doorbellSwitch) {
        const doorbellSwitchService = new hap.Service.StatelessProgrammableSwitch(`${cameraConfig.name} Doorbell Switch`, 'DoorbellSwitch');
        doorbellSwitchService
          .getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent)
          .setProps({
            maxValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
          });
        cameraAccessory.addService(doorbellSwitchService);
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
            log.info(`Setting ${cameraAccessory.displayName} Motion to ${isOn ? 'On' : 'Off'}`);
            const motionService = cameraAccessory.getService(hap.Service.MotionSensor);
            if (motionService) {
              motionService.setCharacteristic(hap.Characteristic.MotionDetected, isOn ? 1 : 0);
              if (isOn) {
                setTimeout(() => {
                  log.info(`Setting ${cameraAccessory.displayName} Button to false`);
                  const motionTriggerService = cameraAccessory.getServiceById(hap.Service.Switch, 'MotionTrigger');
                  if (motionTriggerService) {
                    motionTriggerService.setCharacteristic(hap.Characteristic.On, false);
                  }
                }, timeout * 1000);
              }
            }
            callback(null, isOn);
          });
        cameraAccessory.addService(motionTriggerService);
      }
    }

    const streamingDelegate = new StreamingDelegate(this.log, cameraConfig, this.api, hap, this.config.videoProcessor, this.config.interfaceName);

    cameraAccessory.configureController(streamingDelegate.controller);

    this.accessories.push(cameraAccessory);
  }

  automationHandler(name: string, doorbell = false, active = true): void {
    const accessory = this.accessories.find((curAcc: PlatformAccessory) => curAcc.displayName == name);
    if (accessory) {
      this.log('Switch', doorbell ? 'Doorbell' : 'Motion Detect',
        active ? 'On:' : 'Off:', accessory.displayName);
      if (doorbell) {
        const doorbellSensor = accessory.getService(hap.Service.Doorbell);
        if (doorbellSensor && active) {
          doorbellSensor.updateCharacteristic(hap.Characteristic.ProgrammableSwitchEvent,
            hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
        }
      } else {
        const motionSensor = accessory.getService(hap.Service.MotionSensor);
        if (motionSensor) {
          if (active) {
            motionSensor.setCharacteristic(hap.Characteristic.MotionDetected, 1);
            const timeout = this.cameraConfigs.get(accessory.UUID)?.motionTimeout ?? 1;
            const log = this.log;
            if (timeout > 0) {
              setTimeout(() => {
                log('Motion Detect Timeout:', accessory.displayName);
                motionSensor.setCharacteristic(hap.Characteristic.MotionDetected, 0);
              }, timeout * 1000);
            }
          } else {
            motionSensor.setCharacteristic(hap.Characteristic.MotionDetected, 0);
          }
        }
      }
    }
  }

  didFinishLaunching(): void {
    if (this.config.mqtt) {
      const servermqtt = this.config.mqtt;
      const portmqtt = this.config.portmqtt || '1883';
      let mqtttopic = 'homebridge';
      if (this.config.topic && this.config.topic != 'homebridge/motion') {
        mqtttopic = this.config.topic;
      }
      this.log('Setting up MQTT connection with topic ' + mqtttopic + '...');
      const client = mqtt.connect('mqtt://' + servermqtt + ':' + portmqtt, {
        'username': this.config.usermqtt,
        'password': this.config.passmqtt
      });
      client.on('connect', () => {
        this.log('MQTT Connected!');
        client.subscribe(mqtttopic + '/motion');
        client.subscribe(mqtttopic + '/motion/reset');
        client.subscribe(mqtttopic + '/doorbell');
      });
      client.on('message', (topic: string, message: Buffer) => {
        const name = message.toString();
        if (topic.startsWith(mqtttopic + '/motion')) {
          const active = !topic.endsWith('/reset');
          this.automationHandler(name, false, active);
        } else if (topic.startsWith(mqtttopic + '/doorbell')) {
          this.automationHandler(name, true);
        }
      });
    }
    if (this.config.porthttp) {
      const porthttp = this.config.porthttp;
      this.log('Setting up HTTP server on port ' + porthttp + '...');
      const server = http.createServer();
      server.listen(porthttp);
      server.on('request', (req, res) => {
        const parseurl = url.parse(req.url);
        const pathname = parseurl.pathname;
        const query = parseurl.query;
        if (pathname && query) {
          const path = pathname.split('/');
          const name = decodeURIComponent(query);
          if (path[1] == 'motion') {
            const active = path[2] != 'reset';
            this.automationHandler(name, false, active);
          } else if (path[1] == 'doorbell') {
            this.automationHandler(name, true);
          }
        }
        res.writeHead(200);
        res.end();
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