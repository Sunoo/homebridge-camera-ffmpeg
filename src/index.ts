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
  PlatformConfig,
} from 'homebridge';
import { StreamingDelegate } from './ffmpeg';

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

  configureAccessory(accessory: PlatformAccessory): void {
    // Won't be invoked
  }

  didFinishLaunching(): void {
    const interfaceName = this.config.interfaceName || '';

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
        let accessoryType = hap.Accessory.Categories.CAMERA;
        if (cameraConfig.doorbell) {
          accessoryType = hap.Accessory.Categories.VIDEO_DOORBELL;
        }
        const cameraAccessory = new Accessory(cameraName, uuid, accessoryType);
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

        if (cameraConfig.doorbell) {
          const doorbellService = new hap.Service.Doorbell(`${cameraName} Doorbell`);
          cameraAccessory.addService(doorbellService);
          const switchService = new hap.Service.Switch(`${cameraName} Doorbell Trigger`, 'DoorbellTrigger');
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
          const button = new hap.Service.Switch(cameraName, 'MotionTrigger');
          cameraAccessory.addService(button);

          const motion = new hap.Service.MotionSensor(cameraName);
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

        const cameraSource = new StreamingDelegate(
          hap,
          cameraConfig,
          this.config,
          this.log,
          this.config.videoProcessor,
          interfaceName,
        );
        cameraAccessory.configureCameraSource(cameraSource);
        this.accessories.push(cameraAccessory);
      });

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.accessories);
    }
  }
}

export = (api: API): void => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, FfmpegPlatform);
};
