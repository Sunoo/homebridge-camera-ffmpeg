var Accessory, Service, Characteristic, hap, UUIDGen;

var FFMPEG = require('./ffmpeg').FFMPEG;

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  hap = homebridge.hap;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform("homebridge-camera-ffmpeg", "Camera-ffmpeg", ffmpegPlatform, true);
}

function ffmpegPlatform(log, config, api) {
  var self = this;

  self.log = log;
  self.config = config || {};

  if (api) {
    self.api = api;

    if (api.version < 2.1) {
      throw new Error("Unexpected API version.");
    }

    self.api.on('didFinishLaunching', self.didFinishLaunching.bind(this));
  }
}

ffmpegPlatform.prototype.configureAccessory = function(accessory) {
  // Won't be invoked
}

ffmpegPlatform.prototype.didFinishLaunching = function() {
  var self = this;
  var videoProcessor = self.config.videoProcessor || 'ffmpeg';
  var interfaceName = self.config.interfaceName || '';

  if (self.config.cameras) {
    var configuredAccessories = [];

    var cameras = self.config.cameras;
    cameras.forEach(function(cameraConfig) {
      var cameraName = cameraConfig.name;
      var videoConfig = cameraConfig.videoConfig;

      if (!cameraName || !videoConfig) {
        self.log("Missing parameters.");
        return;
      }

      var uuid = UUIDGen.generate(cameraName);
      var cameraAccessory = new Accessory(cameraName, uuid, hap.Accessory.Categories.CAMERA);
      var cameraAccessoryInfo = cameraAccessory.getService(Service.AccessoryInformation);
      if (cameraConfig.manufacturer) {
        cameraAccessoryInfo.setCharacteristic(Characteristic.Manufacturer, cameraConfig.manufacturer);
      }
      if (cameraConfig.model) {
        cameraAccessoryInfo.setCharacteristic(Characteristic.Model, cameraConfig.model);
      }
      if (cameraConfig.serialNumber) {
        cameraAccessoryInfo.setCharacteristic(Characteristic.SerialNumber, cameraConfig.serialNumber);
      }
      if (cameraConfig.firmwareRevision) {
        cameraAccessoryInfo.setCharacteristic(Characteristic.FirmwareRevision, cameraConfig.firmwareRevision);
      }

      cameraAccessory.context.log = self.log;
      if (cameraConfig.motion) {
        var button = new Service.Switch(cameraName);
        cameraAccessory.addService(button);

        var motion = new Service.MotionSensor(cameraName);
        cameraAccessory.addService(motion);

        button.getCharacteristic(Characteristic.On)
          .on('set', _Motion.bind(cameraAccessory));
      }

      var cameraSource = new FFMPEG(hap, cameraConfig, self.log, videoProcessor, interfaceName);
      cameraAccessory.configureCameraSource(cameraSource);
      configuredAccessories.push(cameraAccessory);
    });

    self.api.publishCameraAccessories("homebridge-camera-ffmpeg", configuredAccessories);
  }
};

function _Motion(on, callback) {
  this.context.log("Setting %s Motion to %s", this.displayName, on);

  this.getService(Service.MotionSensor).setCharacteristic(Characteristic.MotionDetected, (on ? 1 : 0));
  if (on) {
    setTimeout(_Reset.bind(this), 5000);
  }
  callback();
}

function _Reset() {
  this.context.log("Setting %s Button to false", this.displayName);

  this.getService(Service.Switch).setCharacteristic(Characteristic.On, false);
}
