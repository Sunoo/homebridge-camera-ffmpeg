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
      var accessoryType = hap.Accessory.Categories.CAMERA;
      if(cameraConfig.doorbell){
        accessoryType = hap.Accessory.Categories.VIDEO_DOORBELL;
      }
      var cameraAccessory = new Accessory(cameraName, uuid, accessoryType);
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

      if(cameraConfig.doorbell) {
        var doorbellService = new Service.Doorbell(cameraName+" Doorbell");
        cameraAccessory.addService(doorbellService);
        var switchService = new Service.Switch(cameraName + " Doorbell Trigger", "DoorbellTrigger");
        switchService.getCharacteristic(Characteristic.On)
        .on('set', function(state, callback){
          if(state){
            doorbellService.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setValue(0);
            setTimeout(function(){
              switchService.getCharacteristic(Characteristic.On).updateValue(false);
            }, 1000);
          }
          callback(null, state);
        });
        cameraAccessory.addService(switchService);
      }
      cameraAccessory.context.log = self.log;
      if (cameraConfig.motion) {
        var button = new Service.Switch(cameraName, "MotionTrigger");
        cameraAccessory.addService(button);

        var motion = new Service.MotionSensor(cameraName);
        cameraAccessory.addService(motion);

        button.getCharacteristic(Characteristic.On)
        .on('set', function(state, callback){
          motion.setCharacteristic(Characteristic.MotionDetected, (state ? 1 : 0));
          if(state){
            setTimeout(function(){
              button.setCharacteristic(Characteristic.On, false);
            }, 5000);
          }
          callback(null, state);
        });
      }

      var cameraSource = new FFMPEG(hap, cameraConfig, self.log, self.config.videoProcessor, interfaceName);
      cameraAccessory.configureCameraSource(cameraSource);
      configuredAccessories.push(cameraAccessory);
    });

    self.api.publishCameraAccessories("homebridge-camera-ffmpeg", configuredAccessories);
  }
};
