'use strict';
var uuid, Service, Characteristic, StreamController;

var crypto = require('crypto');
var fs = require('fs');
var ip = require('ip');
var spawn = require('child_process').spawn;
const spawnSync = require('child_process').spawnSync;
var drive = require('./drive').drive;

module.exports = {
  FFMPEG: FFMPEG
};

function FFMPEG(hap, cameraConfig, log, videoProcessor) {
  uuid = hap.uuid;
  Service = hap.Service;
  Characteristic = hap.Characteristic;
  StreamController = hap.StreamController;
  this.log = log;

  var ffmpegOpt = cameraConfig.videoConfig;
  this.name = cameraConfig.name;
  this.vcodec = ffmpegOpt.vcodec || 'libx264';
  this.videoProcessor = videoProcessor || 'ffmpeg';
  this.audio = ffmpegOpt.audio;
  this.acodec = ffmpegOpt.acodec || 'libfdk_aac';
  this.packetsize = ffmpegOpt.packetSize || 1316; // 188 376
  this.maxBitrate = ffmpegOpt.maxBitrate || 300;
  this.debug = ffmpegOpt.debug;
  this.global_options = ffmpegOpt.global_options || '';
  this.input_options = ffmpegOpt.input_options || '';
  this.additionalCommandline = ffmpegOpt.additionalCommandline || '-tune zerolatency';

  if (!ffmpegOpt.source) {
    throw new Error("Missing source for camera.");
  }
  this.input_url = ffmpegOpt.source;
  this.input_url_image = ffmpegOpt.stillImageSource !== undefined ? ffmpegOpt.stillImageSource : ffmpegOpt.source;

  this.services = [];
  this.streamControllers = [];

  this.pendingSessions = {};
  this.ongoingSessions = {};

  this.uploader = cameraConfig.uploader || false;
  if ( this.uploader )
    { this.drive = new drive(); }

  var numberOfStreams = ffmpegOpt.maxStreams || 2;
  var videoResolutions = [];

  this.maxWidth = ffmpegOpt.maxWidth || 1920;
  this.maxHeight = ffmpegOpt.maxHeight || 1080;
  let fps = ffmpegOpt.maxFPS || 30;
  this.maxFPS = (fps > 30) ? 30 : fps;

  this.vcopy = false;
  const ffprobe = spawnSync('ffprobe', ('-v error -print_format json -select_streams v:0 -show_entries stream=codec_name,width,height ' + this.input_url).split(' '), {env: process.env});
  if (!(ffprobe.error)) {
    var probe = JSON.parse(ffprobe.stdout);
    if (probe['streams'] && probe['streams'][0]['width'] <= this.maxWidth && probe['streams'][0]['height'] <= this.maxHeight) {
      this.maxWidth = probe['streams'][0]['width'];
      this.maxHeigth = probe['streams'][0]['height'];
      if (probe['streams'][0]['codec_name'] == 'h264' && (
        (this.maxWidth == 1920 && this.maxHeight == 1080) ||
        (this.maxWidth == 1280 && this.maxHeight ==  960) ||
        (this.maxWidth == 1280 && this.maxHeight ==  720) ||
        (this.maxWidth == 1024 && this.maxHeight ==  768) ||
        (this.maxWidth ==  640 && this.maxHeight ==  480) ||
        (this.maxWidth ==  640 && this.maxHeight ==  360) ||
        (this.maxWidth ==  480 && this.maxHeight ==  360) ||
        (this.maxWidth ==  480 && this.maxHeight ==  270) ||
        (this.maxWidth ==  320 && this.maxHeight ==  240) ||
        (this.maxWidth ==  320 && this.maxHeight ==  180))) {
        this.vcopy = true;
      }
    }
  }

  if (this.vcopy){
    if (this.maxWidth == 1920 || this.maxWidth == 1280 || this.maxWidth == 1024) {
      videoResolutions.push([this.maxWidth, this.maxHeight, this.maxFPS]);
      videoResolutions.push([640, 480, this.maxFPS]);
      videoResolutions.push([640, 360, this.maxFPS]);
      videoResolutions.push([480, 360, this.maxFPS]);
      videoResolutions.push([480, 270, this.maxFPS]);
      videoResolutions.push([320, 240, this.maxFPS]);
      videoResolutions.push([320, 180, this.maxFPS]);
      if (this.maxFPS > 15) {
        videoResolutions.push([320, 240, 15]);
        videoResolutions.push([320, 180, 15]);
      }
    } else if (this.maxWidth == 640) {
      videoResolutions.push([this.maxWidth, this.MaxHeight, this.maxFPS]);
      videoResolutions.push([480, 360, this.maxFPS]);
      videoResolutions.push([480, 270, this.maxFPS]);
      videoResolutions.push([320, 240, this.maxFPS]);
      videoResolutions.push([320, 180, this.maxFPS]);
      if (this.maxFPS > 15) {
        videoResolutions.push([320, 240, 15]);
        videoResolutions.push([320, 180, 15]);
      }
    } else if (this.maxWidth == 480) {
      videoResolutions.push([this.maxWidth, this.MaxHeight, this.maxFPS]);
      videoResolutions.push([320, 240, this.maxFPS]);
      videoResolutions.push([320, 180, this.maxFPS]);
      if (this.maxFPS > 15) {
        videoResolutions.push([320, 240, 15]);
        videoResolutions.push([320, 180, 15]);
      }
    } else {
      videoResolutions.push([this.maxWidth, this.MaxHeight, this.maxFPS]);
    }
  } else {
    if (this.maxWidth >= 320) {
      if (this.maxHeight >= 240) {
        videoResolutions.push([320, 240, this.maxFPS]);
        if (this.maxFPS > 15) {
          videoResolutions.push([320, 240, 15]);
        }
      }

      if (this.maxHeight >= 180) {
        videoResolutions.push([320, 180, this.maxFPS]);
        if (this.maxFPS > 15) {
          videoResolutions.push([320, 180, 15]);
        }
      }
    }

    if (this.maxWidth >= 480) {
      if (this.maxHeight >= 360) {
        videoResolutions.push([480, 360, this.maxFPS]);
      }

      if (this.maxHeight >= 270) {
        videoResolutions.push([480, 270, this.maxFPS]);
      }
    }

    if (this.maxWidth >= 640) {
      if (this.maxHeight >= 480) {
        videoResolutions.push([640, 480, this.maxFPS]);
      }

      if (this.maxHeight >= 360) {
        videoResolutions.push([640, 360, this.maxFPS]);
      }
    }

    if (this.maxWidth >= 1280) {
      if (this.maxHeight >= 960) {
        videoResolutions.push([1280, 960, this.maxFPS]);
      }

      if (this.maxHeight >= 720) {
        videoResolutions.push([1280, 720, this.maxFPS]);
      }
    }

    if (this.maxWidth >= 1920) {
      if (this.maxHeight >= 1080) {
        videoResolutions.push([1920, 1080, this.maxFPS]);
      }
    }
  }

  let options = {
    proxy: false, // Requires RTP/RTCP MUX Proxy
    srtp: true, // Supports SRTP AES_CM_128_HMAC_SHA1_80 encryption
    video: {
      resolutions: videoResolutions,
      codec: {
        profiles: [0, 1, 2], // Enum, please refer StreamController.VideoCodecParamProfileIDTypes
        levels: [0, 1, 2] // Enum, please refer StreamController.VideoCodecParamLevelTypes
      }
    },
    audio: {
      codecs: [
        {
          type: "OPUS", // Audio Codec
          samplerate: 24 // 8, 16, 24 KHz
        },
        {
          type: "AAC-eld",
          samplerate: 16
        }
      ]
    }
  }

  this.createCameraControlService();
  this._createStreamControllers(numberOfStreams, options);
}

FFMPEG.prototype.handleCloseConnection = function(connectionID) {
  this.streamControllers.forEach(function(controller) {
    controller.handleCloseConnection(connectionID);
  });
}

FFMPEG.prototype.handleSnapshotRequest = function(request, callback) {
  let global_options = '';
  let input_options = '';
  let input_url = this.input_url_image;
  let output_options = ' -f image2 -t 1 -s '+ request.width + 'x' + request.height;
  let output_url = ' -';
  let ffmpeg = spawn(this.videoProcessor, (global_options + input_options + '-i '+ input_url + output_options + output_url).replace(/\s\s+/g, '').split(' '), {env: process.env});

  this.log("Snapshot from " + this.name + " at " + request.width + 'x' + request.height);
  if(this.debug) console.log(this.videoProcessor + ' ' + global_options + input_options + '-i '+ input_url + output_options + output_url);

  var imageBuffer = Buffer(0);
  this.log("Snapshot from " + this.name + " at " + resolution);
  if(this.debug) console.log('ffmpeg '+imageSource + ' -t 1 -s '+ resolution + ' -f image2 -');
  ffmpeg.stdout.on('data', function(data) {
    imageBuffer = Buffer.concat([imageBuffer, data]);
  });
  let self = this;
  ffmpeg.on('error', function(error){
    self.log("An error occurs while making snapshot request");
    self.debug ? self.log(error) : null;
  });
  ffmpeg.on('close', function(code) {
    if ( this.uploader )
      { this.drive.storePicture(this.name,imageBuffer); }
    callback(undefined, imageBuffer);
  }.bind(this));
}

FFMPEG.prototype.prepareStream = function(request, callback) {
  var sessionInfo = {};

  let sessionID = request["sessionID"];
  let targetAddress = request["targetAddress"];

  sessionInfo["address"] = targetAddress;

  var response = {};

  let videoInfo = request["video"];
  if (videoInfo) {
    let targetPort = videoInfo["port"];
    let srtp_key = videoInfo["srtp_key"];
    let srtp_salt = videoInfo["srtp_salt"];

    // SSRC is a 32 bit integer that is unique per stream
    let ssrcSource = crypto.randomBytes(4);
    ssrcSource[0] = 0;
    let ssrc = ssrcSource.readInt32BE(0, true);

    let videoResp = {
      port: targetPort,
      ssrc: ssrc,
      srtp_key: srtp_key,
      srtp_salt: srtp_salt
    };

    response["video"] = videoResp;

    sessionInfo["video_port"] = targetPort;
    sessionInfo["video_srtp"] = Buffer.concat([srtp_key, srtp_salt]);
    sessionInfo["video_ssrc"] = ssrc;
  }
  if (this.vcopy && width == this.maxWidth && height == this.maxHeight) {
    vcodec = 'copy';
  }

  let audioInfo = request["audio"];
  if (audioInfo) {
    let targetPort = audioInfo["port"];
    let srtp_key = audioInfo["srtp_key"];
    let srtp_salt = audioInfo["srtp_salt"];

    // SSRC is a 32 bit integer that is unique per stream
    let ssrcSource = crypto.randomBytes(4);
    ssrcSource[0] = 0;
    let ssrc = ssrcSource.readInt32BE(0, true);

    let audioResp = {
      port: targetPort,
      ssrc: ssrc,
      srtp_key: srtp_key,
      srtp_salt: srtp_salt
    };

    response["audio"] = audioResp;

    sessionInfo["audio_port"] = targetPort;
    sessionInfo["audio_srtp"] = Buffer.concat([srtp_key, srtp_salt]);
    sessionInfo["audio_ssrc"] = ssrc;
  }

  let currentAddress = ip.address();
  var addressResp = {
    address: currentAddress
  };

  if (ip.isV4Format(currentAddress)) {
    addressResp["type"] = "v4";
  } else {
    addressResp["type"] = "v6";
  }

  response["address"] = addressResp;
  this.pendingSessions[uuid.unparse(sessionID)] = sessionInfo;

  callback(response);
}

FFMPEG.prototype.handleStreamRequest = function(request) {
  var sessionID = request["sessionID"];
  var requestType = request["type"];
  if (sessionID) {
    let sessionIdentifier = uuid.unparse(sessionID);

    if (requestType == "start") {
      var sessionInfo = this.pendingSessions[sessionIdentifier];
      if (sessionInfo) {
        var width = this.maxWidth;
        var height = this.maxHeight;
        var fps = this.maxFPS;
        var vbitrate = this.maxBitrate;
        var abitrate = 32;
        var asamplerate = 16;
        var vcodec = this.vcodec;
        var acodec = this.acodec;
        var packetsize = this.packetsize;
        var additionalCommandline = this.additionalCommandline ;

        let videoInfo = request["video"];
        if (videoInfo) {
          width = videoInfo["width"];
          height = videoInfo["height"];

          let expectedFPS = videoInfo["fps"];
          if (expectedFPS < fps) {
            fps = expectedFPS;
          }
          if(videoInfo["max_bit_rate"] < vbitrate) {
            vbitrate = videoInfo["max_bit_rate"];
          }
        }

        let audioInfo = request["audio"];
        if (audioInfo) {
          abitrate = audioInfo["max_bit_rate"];
          asamplerate = audioInfo["sample_rate"];
        }

        let targetAddress = sessionInfo["address"];
        let targetVideoPort = sessionInfo["video_port"];
        let videoKey = sessionInfo["video_srtp"];
        let videoSsrc = sessionInfo["video_ssrc"];
        let targetAudioPort = sessionInfo["audio_port"];
        let audioKey = sessionInfo["audio_srtp"];
        let audioSsrc = sessionInfo["audio_ssrc"];

        let output_options_vcodec = ' -vcodec ' + vcodec;
        if (vcodec != 'copy') {
          output_options_vcodec +=
          ' -pix_fmt yuv420p' +
          ' -r ' + fps +
          ' ' + additionalCommandline +
          ' -vf scale=' + width + ':' + height +
          ' -b:v ' + vbitrate + 'k' +
          ' -bufsize ' + vbitrate+ 'k' +
          ' -maxrate '+ vbitrate + 'k';
        }

        let output_options_video =
          ' -map 0:0' +
          ' -f rawvideo' +
          output_options_vcodec;

        let output_url_video =
          ' -payload_type 99' +
          ' -ssrc ' + videoSsrc +
          ' -f rtp' +
          ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
          ' -srtp_out_params ' + videoKey.toString('base64') +
          ' srtp://' + targetAddress + ':' + targetVideoPort +
          '?rtcpport=' + targetVideoPort +
          '&localrtcpport=' + targetVideoPort +
          '&pkt_size=' + packetsize;

        let output_options_acodec = ' -acodec ' + acodec;
        if (acodec != 'copy') {
          output_options_acodec += 
            ' -b:a ' + abitrate + 'k' +
            ' -ar ' + asamplerate + 'k' +
            ' -bufsize ' + abitrate + 'k' +
            ' -ac 1';
        }
        if (acodec == 'libfdk_aac') {
          output_options_acodec +=
            ' -profile:a aac_eld' +
            ' -flags +global_header';
        } else if (acodec == 'libopus') {
          output_options_acodec +=
            ' -vbr on' +
            ' -compression_level 5';
        }

        let output_options_audio =
          ' -map 0:1' +
          ' -f null' +
          output_options_acodec;

        let output_url_audio =
          ' -payload_type 110' +
          ' -ssrc ' + audioSsrc +
          ' -f rtp' +
          ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
          ' -srtp_out_params ' + audioKey.toString('base64') +
          ' srtp://' + targetAddress + ':' + targetAudioPort +
          '?rtcpport=' + targetAudioPort +
          '&localrtcpport=' + targetAudioPort +
          '&pkt_size=' + packetsize;

        let global_options = this.global_options != '' ? this.global_options + ' ' :  '';
        let input_options = this.input_options != '' ? this.input_options + ' ' :  '';
        let input_url = this.input_url;
        let output_video = output_options_video + output_url_video;
        let output_audio = (this.audio ? output_options_audio + output_url_audio : '');
        let ffmpeg = spawn(this.videoProcessor, (global_options + input_options + '-i ' + input_url + output_video + output_audio).replace(/\s\s+/g, '').split(' '), {env: process.env});
        this.log("Start streaming video from " + this.name + " with " + width + "x" + height + "@" + fps + "fps" + vbitrate + "kBit");
        if(this.debug){
          console.log(this.videoProcessor + ' ' + global_options + input_options + '-i ' + input_url + output_video + output_audio);
        }

        // Always setup hook on stderr.
        // Without this streaming stops within one to two minutes.
        ffmpeg.stderr.on('data', function(data) {
          // Do not log to the console if debugging is turned off
          if(this.debug){
            console.log(data.toString());
          }
        });
        let self = this;
        ffmpeg.on('error', function(error){
            self.log("An error occurs while making stream request");
            self.debug ? self.log(error) : null;
        });
        ffmpeg.on('close', (code) => {
          if(code == null || code == 0 || code == 255){
            self.log("Stopped streaming");
          } else {
            self.log("ERROR: FFmpeg exited with code " + code);
            for(var i=0; i < self.streamControllers.length; i++){
              var controller = self.streamControllers[i];
              if(controller.sessionIdentifier === sessionID){
                controller.forceStop();
              }
            }
          }
        });
        this.ongoingSessions[sessionIdentifier] = ffmpeg;
      }

      delete this.pendingSessions[sessionIdentifier];
    } else if (requestType == "stop") {
      var ffmpegProcess = this.ongoingSessions[sessionIdentifier];
      if (ffmpegProcess) {
        ffmpegProcess.kill('SIGTERM');
      }
      delete this.ongoingSessions[sessionIdentifier];
    }
  }
}

FFMPEG.prototype.createCameraControlService = function() {
  var controlService = new Service.CameraControl();

  this.services.push(controlService);

  if(this.audio){
    var microphoneService = new Service.Microphone();
    this.services.push(microphoneService);
  }
}

// Private

FFMPEG.prototype._createStreamControllers = function(maxStreams, options) {
  let self = this;

  for (var i = 0; i < maxStreams; i++) {
    var streamController = new StreamController(i, options, self);

    self.services.push(streamController.service);
    self.streamControllers.push(streamController);
  }
}
