import {
  API,
  APIEvent,
  AudioStreamingCodecType,
  AudioStreamingSamplerate,
  CameraControllerOptions,
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  CharacteristicValue,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformAccessoryEvent,
  PlatformConfig,
} from 'homebridge';
import { StreamingDelegate } from './streamingDelegate';
import mqtt = require('mqtt');

let hap: HAP;
let Accessory: typeof PlatformAccessory;

const PLUGIN_NAME = 'homebridge-camera-ffmpeg';
const PLATFORM_NAME = 'Camera-ffmpeg';

class FfmpegPlatform implements DynamicPlatformPlugin {
  private readonly log: Logging;
  private readonly api: API;
  private config: PlatformConfig;
  private cameraConfigs: Map<string, any> = new Map(); // configuration for each camera indexed by uuid
  private readonly accessories: Array<PlatformAccessory> = [];

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.api = api;
    this.config = config;

    // Need a config or plugin will not start
    if (!config) {
      return;
    }

    if (this.config.cameras) {
      // doing some sanity checks and index the camera config by the accessory uuid
      this.config.cameras.forEach((cameraConfig: any) => {
        const cameraName = cameraConfig.name;
        const videoConfig = cameraConfig.videoConfig;

        if (!cameraName || !videoConfig) {
          this.log("Missing parameters ('name' or 'videoConfig') for camera " + cameraName);
          return;
        }

        const uuid = hap.uuid.generate(cameraName);
        if (this.cameraConfigs.has(uuid)) {
          // Camera names must be unique
          this.log(`The camera ${cameraName} seems to be defined more than one time.Ignoring any other occurrences!`);
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

    const cameraConfig = this.cameraConfigs.get(cameraAccessory.UUID) || cameraAccessory.context.cameraConfig;

    const motion = cameraAccessory.getService(hap.Service.MotionSensor);
    const doorbell = cameraAccessory.getService(hap.Service.Doorbell);
    const doorbellSwitch = cameraAccessory.getServiceById(hap.Service.Switch, 'DoorbellTrigger');
    const motionSwitch = cameraAccessory.getServiceById(hap.Service.Switch, 'MotionTrigger');
    const doorbellSwitchSwitch = cameraAccessory.getServiceById(hap.Service.StatelessProgrammableSwitch, 'DoorbellSwitch');

    if (motion) {
      cameraAccessory.removeService(motion);
    }
    if (doorbell) {
      cameraAccessory.removeService(doorbell);
    }
    if (doorbellSwitch) {
      cameraAccessory.removeService(doorbellSwitch);
    }
    if (motionSwitch) {
      cameraAccessory.removeService(motionSwitch);
    }
    if (doorbellSwitchSwitch) {
      cameraAccessory.removeService(doorbellSwitchSwitch);
    }

    if (cameraConfig.doorbell) {
      const doorbellService = new hap.Service.Doorbell(`${cameraConfig.name} Doorbell`);
      cameraAccessory.addService(doorbellService);
      if (cameraConfig.switches) {
        const switchService = new hap.Service.Switch(`${cameraConfig.name} Doorbell Trigger`, 'DoorbellTrigger');
        switchService
          .getCharacteristic(hap.Characteristic.On)
          .on(CharacteristicEventTypes.SET, (state: CharacteristicValue, callback: CharacteristicSetCallback) => {
            if (state) {
              const doorbell = cameraAccessory.getService(hap.Service.Doorbell);
              if (doorbell) {
                doorbell.updateCharacteristic(
                  hap.Characteristic.ProgrammableSwitchEvent,
                  hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
                );

                setTimeout(function () {
                  switchService.getCharacteristic(hap.Characteristic.On).updateValue(false);
                }, 1000);
              }
            }
            callback(null, state);
          });
        cameraAccessory.addService(switchService);
      }

      if (cameraConfig.doorbellSwitch) {
        cameraAccessory
          .addService(hap.Service.StatelessProgrammableSwitch, 'DoorbellSwitch')
          .getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent)
          .setProps({
            maxValue: hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
          });
      }
    }
    if (cameraConfig.motion) {
      const motion = new hap.Service.MotionSensor(cameraConfig.name);
      cameraAccessory.addService(motion);
      const log = this.log;

      if (cameraConfig.switches) {
        const button = new hap.Service.Switch(cameraConfig.name, 'MotionTrigger');
        button
          .getCharacteristic(hap.Characteristic.On)
          .on(CharacteristicEventTypes.SET, (on: CharacteristicValue, callback: CharacteristicSetCallback) => {
            log.info(`Setting ${cameraAccessory.displayName} Motion to ${on}`);
            const motionService = cameraAccessory.getService(hap.Service.MotionSensor);
            if (motionService) {
              motionService.setCharacteristic(hap.Characteristic.MotionDetected, on ? 1 : 0);
              if (on) {
                setTimeout(function () {
                  log.info(`Setting ${cameraAccessory.displayName} Button to false`);
                  const switchService = cameraAccessory.getService(hap.Service.Switch);
                  if (switchService) {
                    switchService.setCharacteristic(hap.Characteristic.On, false);
                  }
                }, 5000);
              }
            }
            callback(null, on);
          });
        cameraAccessory.addService(button);
      }
    }

    const streamingDelegate = new StreamingDelegate(hap, cameraConfig, this.log, this.config.videoProcessor);

    const options: CameraControllerOptions = {
      cameraStreamCount: cameraConfig.videoConfig.maxStreams || 2, // HomeKit requires at least 2 streams, but 1 is also just fine
      delegate: streamingDelegate,
      streamingOptions: {
        supportedCryptoSuites: [hap.SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],
        video: {
          resolutions: [
            [320, 180, 30],
            [320, 240, 15], // Apple Watch requires this configuration
            [320, 240, 30],
            [480, 270, 30],
            [480, 360, 30],
            [640, 360, 30],
            [640, 480, 30],
            [1280, 720, 30],
            [1280, 960, 30],
            [1920, 1080, 30],
            [1600, 1200, 30],
          ],
          codec: {
            profiles: [hap.H264Profile.BASELINE, hap.H264Profile.MAIN, hap.H264Profile.HIGH],
            levels: [hap.H264Level.LEVEL3_1, hap.H264Level.LEVEL3_2, hap.H264Level.LEVEL4_0],
          },
        },
        audio: {
          codecs: [
            {
              type: AudioStreamingCodecType.AAC_ELD,
              samplerate: AudioStreamingSamplerate.KHZ_16,
            },
          ],
        },
      },
    };

    const cameraController = new hap.CameraController(options);
    streamingDelegate.controller = cameraController;

    cameraAccessory.configureController(cameraController);

    this.accessories.push(cameraAccessory);
  }

  mqttHandler(name:string): void  {
    this.accessories.forEach((accessory: PlatformAccessory) => {
      if (accessory.displayName == name) {
        this.log("Switch Motion Detect On:", accessory.displayName);
        const motionSensor = accessory.getService(hap.Service.MotionSensor);
        const doorbellSensor = accessory.getService(hap.Service.Doorbell);
        if (motionSensor) {
          motionSensor.setCharacteristic(hap.Characteristic.MotionDetected, 1);
          setTimeout(function () {
              motionSensor.setCharacteristic(hap.Characteristic.MotionDetected, 0);
            }, 1000);
          }
          if (doorbellSensor) {
            doorbellSensor.updateCharacteristic(
              hap.Characteristic.ProgrammableSwitchEvent,
              hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
          }
        }
      });
   }

  didFinishLaunching(): void {
    if (this.config.mqtt) {
      this.log('Setting up mqtt connection...');
      const servermqtt = this.config.mqtt;
      const port = this.config.portmqtt || '1883';
      const topics = this.config.topics || 'homebridge/motion';
      const client = mqtt.connect('mqtt://' + servermqtt + ':' + port);
      client.on('connect', () => {
        this.log('MQTT CONNECTED!');
        client.subscribe(topics);
      });
      client.on('message', (topic: string, message: Buffer) => {
        const mess = message.toString();
        this.log('MQTT state message received:', mess);
        this.log('Motion Camera:', mess);
        this.mqttHandler(mess);
      });
    }

    for (const [uuid, cameraConfig] of this.cameraConfigs) {
      const cameraName = cameraConfig.name;

      // Only add new cameras that are not cached
      if (!this.accessories.find((x: PlatformAccessory) => x.UUID === uuid)) {
        const cameraAccessory = new Accessory(cameraName, uuid);
        cameraAccessory.context.cameraConfig = cameraConfig;
        const cameraAccessoryInfo = cameraAccessory.getService(hap.Service.AccessoryInformation);
        if (cameraAccessoryInfo) {
          if (cameraConfig.manufacturer) {
            cameraAccessoryInfo.setCharacteristic(hap.Characteristic.Manufacturer, cameraConfig.manufacturer);
          }
          if (cameraConfig.model) {
            cameraAccessoryInfo.setCharacteristic(hap.Characteristic.Model, cameraConfig.model);
          }
          if (cameraConfig.serialNumber) {
            cameraAccessoryInfo.setCharacteristic(hap.Characteristic.SerialNumber, cameraConfig.serialNumber);
          }
          if (cameraConfig.firmwareRevision) {
            cameraAccessoryInfo.setCharacteristic(hap.Characteristic.FirmwareRevision, cameraConfig.firmwareRevision);
          }
        }

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
