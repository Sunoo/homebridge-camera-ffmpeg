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

let hap: HAP;
let Accessory: typeof PlatformAccessory;

const PLUGIN_NAME = 'homebridge-camera-ffmpeg';
const PLATFORM_NAME = 'Camera-ffmpeg';

class FfmpegPlatform implements DynamicPlatformPlugin {
  private readonly log: Logging;
  private readonly api: API;
  private config: PlatformConfig;
  private readonly accessories: Array<PlatformAccessory> = [];

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.api = api;
    this.config = config;

    // Need a config or plugin will not start
    if (!config) {
      return;
    }

    api.on(APIEvent.DID_FINISH_LAUNCHING, this.didFinishLaunching.bind(this));
  }

  configureAccessory(cameraAccessory: PlatformAccessory): void {
    this.log(`Configuring accessory ${cameraAccessory.displayName}`);

    cameraAccessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
      this.log(`${cameraAccessory.displayName} identified!`);
    });

    const cameraConfig = cameraAccessory.context.cameraConfig;

    const motion = cameraAccessory.getService(hap.Service.MotionSensor);
    const doorbellSwitch = cameraAccessory.getServiceById(hap.Service.Switch, 'DoorbellTrigger');
    const motionSwitch = cameraAccessory.getServiceById(hap.Service.Switch, 'MotionTrigger');
    const doorbell = cameraAccessory.getService(hap.Service.Doorbell);

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

    if (cameraConfig.doorbell) {
      const doorbellService = new hap.Service.Doorbell(`${cameraConfig.name} Doorbell`);
      cameraAccessory.addService(doorbellService);
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
    if (cameraConfig.motion) {
      const button = new hap.Service.Switch(cameraConfig.name, 'MotionTrigger');
      cameraAccessory.addService(button);

      const motion = new hap.Service.MotionSensor(cameraConfig.name);
      cameraAccessory.addService(motion);
      const log = this.log;

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

  didFinishLaunching(): void {
    if (this.config.cameras) {
      const cameras = this.config.cameras;
      cameras.forEach((cameraConfig: any) => {
        const cameraName = cameraConfig.name;
        const videoConfig = cameraConfig.videoConfig;

        if (!cameraName || !videoConfig) {
          this.log('Missing parameters.');
          return;
        }
        // Camera names must be unique
        const uuid = hap.uuid.generate(cameraName);
        cameraConfig.uuid = uuid;
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

        // Only add new cameras that are not cached
        if (!this.accessories.find((x: PlatformAccessory) => x.UUID === uuid)) {
          this.configureAccessory(cameraAccessory); // abusing the configureAccessory here
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [cameraAccessory]);
        }
      });

      // Remove cameras that were not in previous call
      this.accessories.forEach((accessory: PlatformAccessory) => {
        if (!cameras.find((x: any) => x.uuid === accessory.context.cameraConfig.uuid)) {
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      });
    }
  }
}

export = (api: API): void => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, FfmpegPlatform);
};
