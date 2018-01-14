'use strict';

var Accessory, hap, UUIDGen;

var http = require('http');
var https = require('https');

var debug = require('debug')('camera-ffmpeg-ufv');
var UFV = require('./ufv.js').UFV;

const apiEndpoint = '/api/2.0';

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  hap = homebridge.hap;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform("homebridge-camera-ffmpeg-ufv", "camera-ffmpeg-ufv", ffmpegUfvPlatform, true);
}

function ffmpegUfvPlatform(log, config, api) {
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

// Won't be invoked
ffmpegUfvPlatform.prototype.configureAccessory = function(accessory) {
}

ffmpegUfvPlatform.prototype.didFinishLaunching = function() {
  var self = this;

  if (self.config.nvrs) {

    var configuredAccessories = [];

    var nvrs = self.config.nvrs;

    nvrs.forEach(function(nvrConfig) {

      // From the config we need the host and API key for the NVR.
      // - Host will be the NVR's hostname or IP and port, ie "nvr.example.com:7080"
      // - API key is created in NVR user settings
      var options = {
        host: nvrConfig.apiHost,
        port: nvrConfig.apiPort,
        path: apiEndpoint + '/bootstrap?apiKey=' + nvrConfig.apiKey,
        rejectUnauthorized: false // bypass the self-signed certificate error. Bleh
      };


      // Fetch the "bootstrap" file from the NVR,
      // which contains all the config info we need:

      (nvrConfig.apiProtocol == 'https' ? https : http ).get(options, function (res) {

        var json = '';

        res.on('data', function (chunk) {
          json += chunk;
        });

        res.on('end', function () {

          if (res.statusCode === 200) {

            try {
              var parsedResponse = JSON.parse(json);

              // At this point we should have the NVR configuration.

              var serverName;
              var streamingHost;
              var streamingPort;
              var channels = [];

              // The root of the result is "data"
              var discoveredNvrs = parsedResponse.data;

              discoveredNvrs.forEach(function(discoveredNvr) {
                debug("Discovered NVR " + discoveredNvr.nvrName);

                // In the old API, the NVR knows the rtsp port.
                // If this is not defined, we'll look for it in the
                // channel definition later:
                streamingPort = discoveredNvr.systemInfo.rtspPort;

                // Within each NVR we should have one or more servers:
                var discoveredServers = discoveredNvr.servers;

                discoveredServers.forEach(function(discoveredServer) {
                  debug("Discovered server " + discoveredServer.name);

                  serverName = discoveredServer.name;

                  // Hostname for the streams:
                  streamingHost = discoveredServer.host;

                });

                // Hack: there is at this time only one 'server' object.
                // We are assuming there will only be one.
                // If this changes, things will probably break!

                // Within each NVR we should have one or more cameras:
                var discoveredCameras = discoveredNvr.cameras;

                discoveredCameras.forEach(function(discoveredCamera) {
                  // Each camera has more than one channel.
                  // The channel is where the actual streaming params live:

                  var discoveredChannels = discoveredCamera.channels;

                  // Go through each channel, see if it is rtspEnabled, and if so,
                  // post it to homebridge and move on to the next camera

                  for(var channelIndex = 0; channelIndex < discoveredChannels.length; channelIndex++) {

                    var discoveredChannel = discoveredChannels[channelIndex];

                    // Let's see if this channel has RSTP enabled:
                    if(discoveredChannel.isRtspEnabled == true) {
                      var rtspAlias = discoveredChannel.rtspAlias;

                      debug('Discovered RTSP enabled camera ' + discoveredCamera.uuid);

                      // Set the RTSP URI. Let's first try the new way (>=3.9.0), then try the old way.

                      if ( discoveredChannel.hasOwnProperty('rtspUris') ) {
                        var rtspUri = discoveredChannel.rtspUris[0];
                      } else {
                        var rtspUri = 'rtsp://' + streamingHost + ':' + streamingPort + '/' + rtspAlias;
                      }

                      // We should know have everything we need and can push it to
                      // UFV:

                      var videoConfig = {
                        "source": ('-rtsp_transport http -re -i ' + rtspUri + '?apiKey=' + nvrConfig.apiKey),
                        "stillImageSource": ((nvrConfig.apiProtocol == 'https' ? 'https' : 'http') + '://' + nvrConfig.apiHost + ':' + nvrConfig.apiPort + apiEndpoint + '/snapshot/camera/' + discoveredCamera._id + '?force=true&apiKey=' + nvrConfig.apiKey),
                        "maxStreams": 2,
                        "maxWidth": discoveredChannel.width, // or however we end up getting to this!
                        "maxHeight": discoveredChannel.height,
                        "maxFPS": discoveredChannel.fps
                      };

                      debug('Config: ' + JSON.stringify(videoConfig));

                      // Create a new Accessory for this camera:
                      var cameraAccessory = new Accessory(discoveredCamera.name, discoveredCamera.uuid, hap.Accessory.Categories.CAMERA);
                      var cameraConfig = {name: discoveredCamera.name, videoConfig: videoConfig};

                      debug(JSON.stringify(cameraConfig));

                      var cameraSource = new UFV(hap, cameraConfig);
                      cameraAccessory.configureCameraSource(cameraSource);
                      configuredAccessories.push(cameraAccessory);

                      // Jump out of the loop once we have one:
                      channelIndex = discoveredChannels.length;

                    };

                  };

                });

              });

              // Publish the cameras we found to homebridge:
              self.api.publishCameraAccessories("camera-ffmpeg-ufv", configuredAccessories);

              self.log('Published ' + configuredAccessories.length + ' camera accessories.');

            } catch (e) {
              debug('Error parsing JSON! ' + e);
            }

          } else {
            debug('Status:', res.statusCode);
          }
        });

      }).on('error', function (err) {
        debug('Error:', err);
      });

    });

  }

}
