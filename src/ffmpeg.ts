import {
  AudioStreamingCodecType,
  AudioStreamingSamplerate,
  CameraControllerOptions,
  CameraController,
  CameraStreamingDelegate,
  HAP,
  Logging,
  PlatformConfig,
  PrepareStreamCallback,
  PrepareStreamRequest,
  PrepareStreamResponse,
  SnapshotRequest,
  SnapshotRequestCallback,
  SRTPCryptoSuites,
  StreamingRequest,
  StreamRequestCallback,
  StreamRequestTypes,
  StreamSessionIdentifier,
  VideoInfo,
  AudioInfo,
} from 'homebridge';
import ip from 'ip';
import { ChildProcess, spawn } from 'child_process';

let StreamController;

const drive = require('./drive').drive;

const pathToFfmpeg = require('ffmpeg-for-homebridge'); // eslint-disable-line @typescript-eslint/no-var-requires

export class StreamingDelegate implements CameraStreamingDelegate {
  private readonly log: Logging;
  private config: PlatformConfig;
  fps: number;

  constructor(
    hap: HAP,
    cameraConfig: any,
    config: PlatformConfig,
    log: Logging,
    videoProcessor: string,
    interfaceName: string,
  ) {
    this.log = log;
    this.config = config;
    const ffmpegOpt = cameraConfig.videoConfig;
    this.name = cameraConfig.name;
    this.vcodec = ffmpegOpt.vcodec;
    this.videoProcessor = videoProcessor || pathToFfmpeg || 'ffmpeg';
    this.audio = ffmpegOpt.audio;
    this.acodec = ffmpegOpt.acodec;
    this.packetsize = ffmpegOpt.packetSize;
    this.fps = ffmpegOpt.maxFPS || 10;
    this.maxBitrate = ffmpegOpt.maxBitrate || 300;
    this.minBitrate = ffmpegOpt.minBitrate || 0;
    if (this.minBitrate > this.maxBitrate) {
      this.minBitrate = this.maxBitrate;
    }
    this.debug = ffmpegOpt.debug;
    this.additionalCommandline = ffmpegOpt.additionalCommandline || '-tune zerolatency';
    this.vflip = ffmpegOpt.vflip || false;
    this.hflip = ffmpegOpt.hflip || false;
    this.mapvideo = ffmpegOpt.mapvideo || '0:0';
    this.mapaudio = ffmpegOpt.mapaudio || '0:1';
    this.videoFilter = ffmpegOpt.videoFilter || null; // null is a valid discrete value
    this.interfaceName = interfaceName;

    if (!ffmpegOpt.source) {
      throw new Error('Missing source for camera.');
    }

    this.ffmpegSource = ffmpegOpt.source;
    this.ffmpegImageSource = ffmpegOpt.stillImageSource;

    this.services = [];
    this.streamControllers = [];

    this.pendingSessions = {};
    this.ongoingSessions = {};

    this.uploader = cameraConfig.uploader || false;
    if (this.uploader) {
      this.drive = new drive();
    }

    const numberOfStreams = ffmpegOpt.maxStreams || 2;
    const videoResolutions = [];

    this.maxWidth = ffmpegOpt.maxWidth || 1280;
    this.maxHeight = ffmpegOpt.maxHeight || 720;
    this.preserveRatio = ffmpegOpt.preserveRatio || '';
    const maxFPS = this.fps > 30 ? 30 : this.fps;

    if (this.maxWidth >= 320) {
      if (this.maxHeight >= 240) {
        videoResolutions.push([320, 240, maxFPS]);
        if (maxFPS > 15) {
          videoResolutions.push([320, 240, 15]);
        }
      }

      if (this.maxHeight >= 180) {
        videoResolutions.push([320, 180, maxFPS]);
        if (maxFPS > 15) {
          videoResolutions.push([320, 180, 15]);
        }
      }
    }

    if (this.maxWidth >= 480) {
      if (this.maxHeight >= 360) {
        videoResolutions.push([480, 360, maxFPS]);
      }

      if (this.maxHeight >= 270) {
        videoResolutions.push([480, 270, maxFPS]);
      }
    }

    if (this.maxWidth >= 640) {
      if (this.maxHeight >= 480) {
        videoResolutions.push([640, 480, maxFPS]);
      }

      if (this.maxHeight >= 360) {
        videoResolutions.push([640, 360, maxFPS]);
      }
    }

    if (this.maxWidth >= 1280) {
      if (this.maxHeight >= 960) {
        videoResolutions.push([1280, 960, maxFPS]);
      }

      if (this.maxHeight >= 720) {
        videoResolutions.push([1280, 720, maxFPS]);
      }
    }

    if (this.maxWidth >= 1920) {
      if (this.maxHeight >= 1080) {
        videoResolutions.push([1920, 1080, maxFPS]);
      }
    }

    const options = {
      proxy: false, // Requires RTP/RTCP MUX Proxy
      srtp: true, // Supports SRTP AES_CM_128_HMAC_SHA1_80 encryption
      video: {
        resolutions: videoResolutions,
        codec: {
          profiles: [0, 1, 2], // Enum, please refer StreamController.VideoCodecParamProfileIDTypes
          levels: [0, 1, 2], // Enum, please refer StreamController.VideoCodecParamLevelTypes
        },
      },
      audio: {
        codecs: [
          {
            type: AudioStreamingCodecType.OPUS,
            samplerate: AudioStreamingSamplerate.KHZ_24,
          },
          {
            type: AudioStreamingCodecType.AAC_ELD,
            samplerate: AudioStreamingSamplerate.KHZ_16,
          },
        ],
      },
    };

    this.createCameraControlService();
    this._createStreamControllers(numberOfStreams, options);
  }

  handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback): void {
    let width = request.width;
    let height = request.height;
    if (width > this.maxWidth) {
      width = this.maxWidth;
    }
    if (height > this.maxHeight) {
      height = this.maxHeight;
    }
    let resolution = width + ':' + height;
    switch (this.preserveRatio) {
      case 'W':
        resolution = width + ':-1';
        break;
      case 'H':
        resolution = '-1:' + height;
        break;
      default:
        break;
    }
    const vf = [];
    const videoFilter = this.videoFilter === '' || this.videoFilter === null ? 'scale=' + resolution : this.videoFilter; // empty string or null indicates default
    // In the case of null, skip entirely
    if (videoFilter !== null && videoFilter !== 'none') {
      if (this.hflip) {
        vf.push('hflip');
      }

      if (this.vflip) {
        vf.push('vflip');
      }

      vf.push(videoFilter); // vflip and hflip filters must precede the scale filter to work
    }
    const imageSource = this.ffmpegImageSource !== undefined ? this.ffmpegImageSource : this.ffmpegSource;
    const ffmpeg = spawn(
      this.videoProcessor,
      (imageSource + ' -t 1' + (vf.length > 0 ? ' -vf ' + vf.join(',') : '') + ' -f image2 -').split(' '),
      { env: process.env },
    );
    let imageBuffer = Buffer.alloc(0);
    this.log(`Snapshot from ${this.name} at ${resolution}`);
    if (this.debug) {
      this.log(`ffmpeg ${imageSource} -t 1${vf.length > 0 ? ' -vf ' + vf.join(',') : ''} -f image2 -`);
    }
    ffmpeg.stdout.on('data', function (data) {
      imageBuffer = Buffer.concat([imageBuffer, data]);
    });
    const self = this;
    ffmpeg.on('error', function (error) {
      self.log('An error occurs while making snapshot request');
      self.debug ? self.log(error) : null;
    });
    ffmpeg.on(
      'close',
      function (code) {
        if (this.uploader) {
          this.drive.storePicture(this.name, imageBuffer);
        }
        callback(undefined, imageBuffer);
      }.bind(this),
    );
  }

  handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback): void {
    const sessionID = request['sessionID'];
    const requestType = request['type'];
    if (sessionID) {
      const sessionIdentifier = uuid.unparse(sessionID);

      if (requestType == 'start') {
        const sessionInfo = this.pendingSessions[sessionIdentifier];
        if (sessionInfo) {
          let width = 1280;
          let height = 720;
          let fps = this.fps || 30;
          let vbitrate = this.maxBitrate;
          let abitrate = 32;
          let asamplerate = 16;
          const vcodec = this.vcodec || 'libx264';
          const acodec = this.acodec || 'libfdk_aac';
          const packetsize = this.packetsize || 1316; // 188 376
          const additionalCommandline = this.additionalCommandline;
          const mapvideo = this.mapvideo;
          const mapaudio = this.mapaudio;

          const videoInfo = request['video'];
          if (videoInfo) {
            width = videoInfo['width'];
            height = videoInfo['height'];

            const expectedFPS = videoInfo['fps'];
            if (expectedFPS < fps) {
              fps = expectedFPS;
            }
            if (videoInfo['max_bit_rate'] < vbitrate) {
              vbitrate = videoInfo['max_bit_rate'];
            }
          }

          if (width > this.maxWidth) {
            width = this.maxWidth;
          }
          if (height > this.maxHeight) {
            height = this.maxHeight;
          }

          let resolution = width + ':' + height;
          switch (this.preserveRatio) {
            case 'W':
              resolution = width + ':-1';
              break;
            case 'H':
              resolution = '-1:' + height;
              break;
            default:
              break;
          }

          if (vbitrate < this.minBitrate) {
            vbitrate = this.minBitrate;
          }

          const audioInfo = request['audio'];
          if (audioInfo) {
            abitrate = audioInfo['max_bit_rate'];
            asamplerate = audioInfo['sample_rate'];
          }

          const targetAddress = sessionInfo['address'];
          const targetVideoPort = sessionInfo['video_port'];
          const videoKey = sessionInfo['video_srtp'];
          const videoSsrc = sessionInfo['video_ssrc'];
          const targetAudioPort = sessionInfo['audio_port'];
          const audioKey = sessionInfo['audio_srtp'];
          const audioSsrc = sessionInfo['audio_ssrc'];
          const vf = [];

          const videoFilter =
            this.videoFilter === '' || this.videoFilter === null ? 'scale=' + resolution : this.videoFilter; // empty string or null indicates default
          // In the case of null, skip entirely
          if (videoFilter !== null && videoFilter !== 'none' && vcodec !== 'copy') {
            // Filters cannot be set if the copy vcodec is used.
            vf.push(videoFilter);

            if (this.hflip) vf.push('hflip');

            if (this.vflip) vf.push('vflip');
          }

          let fcmd = this.ffmpegSource;

          const ffmpegVideoArgs =
            ' -map ' +
            mapvideo +
            ' -vcodec ' +
            vcodec +
            ' -pix_fmt yuv420p' +
            ' -r ' +
            fps +
            ' -f rawvideo' +
            ' ' +
            additionalCommandline +
            (vf.length > 0 ? ' -vf ' + vf.join(',') : '') +
            ' -b:v ' +
            vbitrate +
            'k' +
            ' -bufsize ' +
            vbitrate +
            'k' +
            ' -maxrate ' +
            vbitrate +
            'k' +
            ' -payload_type 99';

          const ffmpegVideoStream =
            ' -ssrc ' +
            videoSsrc +
            ' -f rtp' +
            ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
            ' -srtp_out_params ' +
            videoKey.toString('base64') +
            ' srtp://' +
            targetAddress +
            ':' +
            targetVideoPort +
            '?rtcpport=' +
            targetVideoPort +
            '&localrtcpport=' +
            targetVideoPort +
            '&pkt_size=' +
            packetsize;

          // build required video arguments
          fcmd += ffmpegVideoArgs;
          fcmd += ffmpegVideoStream;

          // build optional audio arguments
          if (this.audio) {
            const ffmpegAudioArgs =
              ' -map ' +
              mapaudio +
              ' -acodec ' +
              acodec +
              ' -profile:a aac_eld' +
              ' -flags +global_header' +
              ' -f null' +
              ' -ar ' +
              asamplerate +
              'k' +
              ' -b:a ' +
              abitrate +
              'k' +
              ' -bufsize ' +
              abitrate +
              'k' +
              ' -ac 1' +
              ' -payload_type 110';

            const ffmpegAudioStream =
              ' -ssrc ' +
              audioSsrc +
              ' -f rtp' +
              ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
              ' -srtp_out_params ' +
              audioKey.toString('base64') +
              ' srtp://' +
              targetAddress +
              ':' +
              targetAudioPort +
              '?rtcpport=' +
              targetAudioPort +
              '&localrtcpport=' +
              targetAudioPort +
              '&pkt_size=' +
              packetsize;

            fcmd += ffmpegAudioArgs;
            fcmd += ffmpegAudioStream;
          }

          if (this.debug) {
            fcmd += ' -loglevel debug';
          }

          // start the process
          const ffmpeg = spawn(this.videoProcessor, fcmd.split(' '), { env: process.env });
          this.log(
            'Start streaming video from ' +
              this.name +
              ' with ' +
              resolution +
              '@' +
              fps +
              'fps (' +
              vbitrate +
              'kBit)',
          );
          if (this.debug) {
            console.log(this.videoProcessor + ' ' + fcmd);
          }

          // Always setup hook on stderr.
          // Without this streaming stops within one to two minutes.
          ffmpeg.stderr.on(
            'data',
            function (data) {
              // Do not log to the console if debugging is turned off
              if (this.debug) {
                console.log(data.toString());
              }
            }.bind(this),
          );
          const self = this;
          ffmpeg.on('error', function (error) {
            self.log('An error occurs while making stream request');
            self.debug ? self.log(error) : null;
          });
          ffmpeg.on('close', (code) => {
            if (code == null || code == 0 || code == 255) {
              self.log('Stopped streaming');
            } else {
              self.log('ERROR: FFmpeg exited with code ' + code);
              for (let i = 0; i < self.streamControllers.length; i++) {
                const controller = self.streamControllers[i];
                if (controller.sessionIdentifier === sessionID) {
                  controller.forceStop();
                }
              }
            }
          });
          this.ongoingSessions[sessionIdentifier] = ffmpeg;
        }

        delete this.pendingSessions[sessionIdentifier];
      } else if (requestType == 'stop') {
        const ffmpegProcess = this.ongoingSessions[sessionIdentifier];
        if (ffmpegProcess) {
          ffmpegProcess.kill('SIGTERM');
        }
        delete this.ongoingSessions[sessionIdentifier];
      }
    }
  }

  handleCloseConnection(connectionID: void) {
    this.streamControllers.forEach(function (controller) {
      controller.handleCloseConnection(connectionID);
    });
  }
}

FFMPEG.prototype.prepareStream = function (request, callback) {
  const sessionInfo = {};

  const sessionID = request['sessionID'];
  const targetAddress = request['targetAddress'];

  sessionInfo['address'] = targetAddress;

  const response = {};

  const videoInfo = request['video'];
  if (videoInfo) {
    const targetPort = videoInfo['port'];
    const srtp_key = videoInfo['srtp_key'];
    const srtp_salt = videoInfo['srtp_salt'];

    // SSRC is a 32 bit integer that is unique per stream
    const ssrcSource = this.hap.CameraController.generateSynchronisationSource();
    ssrcSource[0] = 0;
    const ssrc = ssrcSource.readInt32BE(0, true);

    const videoResp = {
      port: targetPort,
      ssrc: ssrc,
      srtp_key: srtp_key,
      srtp_salt: srtp_salt,
    };

    response['video'] = videoResp;

    sessionInfo['video_port'] = targetPort;
    sessionInfo['video_srtp'] = Buffer.concat([srtp_key, srtp_salt]);
    sessionInfo['video_ssrc'] = ssrc;
  }

  const audioInfo = request['audio'];
  if (audioInfo) {
    const targetPort = audioInfo['port'];
    const srtp_key = audioInfo['srtp_key'];
    const srtp_salt = audioInfo['srtp_salt'];

    // SSRC is a 32 bit integer that is unique per stream
    const ssrcSource = this.hap.CameraController.generateSynchronisationSource();
    ssrcSource[0] = 0;
    const ssrc = ssrcSource.readInt32BE(0, true);

    const audioResp = {
      port: targetPort,
      ssrc: ssrc,
      srtp_key: srtp_key,
      srtp_salt: srtp_salt,
    };

    response['audio'] = audioResp;

    sessionInfo['audio_port'] = targetPort;
    sessionInfo['audio_srtp'] = Buffer.concat([srtp_key, srtp_salt]);
    sessionInfo['audio_ssrc'] = ssrc;
  }

  const currentAddress = ip.address(this.interfaceName);
  const addressResp = {
    address: currentAddress,
  };

  if (ip.isV4Format(currentAddress)) {
    addressResp['type'] = 'v4';
  } else {
    addressResp['type'] = 'v6';
  }

  response['address'] = addressResp;
  this.pendingSessions[uuid.unparse(sessionID)] = sessionInfo;

  callback(response);
};

FFMPEG.prototype.createCameraControlService = function () {
  const controlService = new hap.Service.CameraControl();

  this.services.push(controlService);

  if (this.audio) {
    const microphoneService = new hap.Service.Microphone();
    this.services.push(microphoneService);
  }
};

// Private

FFMPEG.prototype._createStreamControllers = function (maxStreams, options) {
  const self = this;

  for (let i = 0; i < maxStreams; i++) {
    const streamController = new StreamController(i, options, self);

    self.services.push(streamController.service);
    self.streamControllers.push(streamController);
  }
};
