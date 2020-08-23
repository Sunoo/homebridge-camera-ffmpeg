import {
  API,
  APIEvent,
  AudioStreamingCodecType,
  AudioStreamingSamplerate,
  CameraController,
  CameraControllerOptions,
  CameraStreamingDelegate,
  HAP,
  PrepareStreamCallback,
  PrepareStreamRequest,
  PrepareStreamResponse,
  SnapshotRequest,
  SnapshotRequestCallback,
  SRTPCryptoSuites,
  StartStreamRequest,
  StreamingRequest,
  StreamRequestCallback,
  StreamRequestTypes,
  VideoInfo
} from 'homebridge';
import { spawn } from 'child_process';
import { createSocket } from 'dgram';
import getPort from 'get-port';
import os from 'os';
import { networkInterfaceDefault } from 'systeminformation';
import { CameraConfig, VideoConfig } from './configTypes';
import { FfmpegProcess } from './ffmpeg';
import { Logger } from './logger';
const pathToFfmpeg = require('ffmpeg-for-homebridge'); // eslint-disable-line @typescript-eslint/no-var-requires

type SessionInfo = {
  address: string; // address of the HAP controller
  localAddress: string;
  addressVersion: ('ipv6' | 'ipv4');

  videoPort: number;
  videoReturnPort: number;
  videoCryptoSuite: SRTPCryptoSuites; // should be saved if multiple suites are supported
  videoSRTP: Buffer; // key and salt concatenated
  videoSSRC: number; // rtp synchronisation source

  audioPort: number;
  audioReturnPort: number;
  audioCryptoSuite: SRTPCryptoSuites;
  audioSRTP: Buffer;
  audioSSRC: number;
};

type ResolutionInfo = {
  width: number;
  height: number;
  videoFilter: string;
};

export class StreamingDelegate implements CameraStreamingDelegate {
  private readonly hap: HAP;
  private readonly log: Logger;
  private readonly name: string;
  private readonly videoConfig: VideoConfig;
  private readonly videoProcessor: string;
  private readonly interfaceName?: string;
  private timeout?: NodeJS.Timeout;
  controller: CameraController;

  // keep track of sessions
  pendingSessions: Record<string, SessionInfo> = {};
  ongoingSessions: Record<string, FfmpegProcess> = {};

  constructor(log: Logger, cameraConfig: CameraConfig, api: API, hap: HAP, videoProcessor: string, interfaceName?: string) { // eslint-disable-line @typescript-eslint/explicit-module-boundary-types
    this.log = log;
    this.videoConfig = cameraConfig.videoConfig;
    this.hap = hap;

    this.name = cameraConfig.name;
    this.videoProcessor = videoProcessor || pathToFfmpeg || 'ffmpeg';
    this.interfaceName = interfaceName;

    api.on(APIEvent.SHUTDOWN, () => {
      for (const session in this.ongoingSessions) {
        this.stopStream(session);
      }
    });

    const options: CameraControllerOptions = {
      cameraStreamCount: cameraConfig.videoConfig.maxStreams || 2, // HomeKit requires at least 2 streams, but 1 is also just fine
      delegate: this,
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
            [1600, 1200, 30]
          ],
          codec: {
            profiles: [hap.H264Profile.BASELINE, hap.H264Profile.MAIN, hap.H264Profile.HIGH],
            levels: [hap.H264Level.LEVEL3_1, hap.H264Level.LEVEL3_2, hap.H264Level.LEVEL4_0]
          }
        },
        audio: {
          codecs: [
            {
              type: AudioStreamingCodecType.AAC_ELD,
              samplerate: AudioStreamingSamplerate.KHZ_16
            }
          ]
        }
      }
    };

    this.controller = new hap.CameraController(options);
  }

  private determineResolution(request: SnapshotRequest | VideoInfo, isSnapshot = false): ResolutionInfo {
    let width = request.width;
    let height = request.height;
    if (!isSnapshot) {
      if ((this.videoConfig.forceMax && this.videoConfig.maxWidth) ||
        (request.width > this.videoConfig.maxWidth)) {
        width = this.videoConfig.maxWidth;
      }
      if ((this.videoConfig.forceMax && this.videoConfig.maxHeight) ||
        (request.height > this.videoConfig.maxHeight)) {
        height = this.videoConfig.maxHeight;
      }
    }

    const vf: Array<string> = [];
    if (this.videoConfig.videoFilter !== 'none') {
      if (this.videoConfig.videoFilter) {
        vf.push(this.videoConfig.videoFilter);
      }
      if (width > 0 || height > 0) {
        vf.push('scale=' + (width > 0 ? '\'min(' + width + ',iw)\'' : 'iw') + ':' +
          (height > 0 ? '\'min(' + height + ',ih)\'' : 'ih') +
          (this.videoConfig.preserveRatio ? ':force_original_aspect_ratio=decrease' : ''));
        vf.push('scale=trunc(iw/2)*2:trunc(ih/2)*2'); // Force to fit encoder restrictions
      }
    }

    return {width: width, height: height, videoFilter: vf.join(',')};
  }

  handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback): void {
    const resolution = this.determineResolution(request);

    this.log.debug('Snapshot requested: ' + request.width + ' x ' + request.height, this.name, this.videoConfig.debug);
    this.log.debug('Sending snapshot: ' + (resolution.width > 0 ? resolution.width : 'native') + ' x ' +
      (resolution.height > 0 ? resolution.height : 'native'), this.name, this.videoConfig.debug);

    let ffmpegArgs = this.videoConfig.stillImageSource || this.videoConfig.source;

    ffmpegArgs += // Still
      ' -frames:v 1' +
      (resolution.videoFilter ? ' -filter:v ' + resolution.videoFilter : '') +
      ' -f image2 -';

    try {
      const ffmpeg = spawn(this.videoProcessor, ffmpegArgs.split(/\s+/), { env: process.env });

      let imageBuffer = Buffer.alloc(0);
      this.log.debug('Snapshot command: ' + this.videoProcessor + ' ' + ffmpegArgs, this.name, this.videoConfig.debug);
      ffmpeg.stdout.on('data', (data: Uint8Array) => {
        imageBuffer = Buffer.concat([imageBuffer, data]);
      });
      const log = this.log;
      ffmpeg.on('error', (error: string) => {
        log.error('An error occurred while making snapshot request: ' + error, this.name);
      });
      ffmpeg.on('close', () => {
        callback(undefined, imageBuffer);
      });
    } catch (err) {
      this.log.error(err, this.name);
      callback(err);
    }
  }

  async getIpAddress(addressVersion: ('ipv6' | 'ipv4'), interfaceName?: string): Promise<string> {
    if (!interfaceName) {
      interfaceName = await networkInterfaceDefault();
    }
    const interfaces = os.networkInterfaces();
    const externalInfo = interfaces[interfaceName]?.filter((info) => {
      return !info.internal;
    });
    const addressInfo = externalInfo?.find((info) => {
      return info.family.toLowerCase() === addressVersion;
    }) || externalInfo?.[0];
    if (!addressInfo) {
      throw new Error('Unable to get network address for "' + interfaceName + '"!');
    }
    return addressInfo.address;
  }

  async prepareStream(request: PrepareStreamRequest, callback: PrepareStreamCallback): Promise<void> {
    const videoReturnPort = await getPort();
    const videoSSRC = this.hap.CameraController.generateSynchronisationSource();
    const audioReturnPort = await getPort();
    const audioSSRC = this.hap.CameraController.generateSynchronisationSource();

    let currentAddress: string;
    try {
      currentAddress = await this.getIpAddress(request.addressVersion, this.interfaceName);
    } catch (ex) {
      if (this.interfaceName) {
        this.log.warn(ex + ' Falling back to default.', this.name);
        currentAddress = await this.getIpAddress(request.addressVersion);
      } else {
        throw ex;
      }
    }

    const sessionInfo: SessionInfo = {
      address: request.targetAddress,
      localAddress: currentAddress,
      addressVersion: request.addressVersion,

      videoPort: request.video.port,
      videoReturnPort: videoReturnPort,
      videoCryptoSuite: request.video.srtpCryptoSuite,
      videoSRTP: Buffer.concat([request.video.srtp_key, request.video.srtp_salt]),
      videoSSRC: videoSSRC,

      audioPort: request.audio.port,
      audioReturnPort: audioReturnPort,
      audioCryptoSuite: request.audio.srtpCryptoSuite,
      audioSRTP: Buffer.concat([request.audio.srtp_key, request.audio.srtp_salt]),
      audioSSRC: audioSSRC
    };

    const response: PrepareStreamResponse = {
      address: currentAddress,
      video: {
        port: videoReturnPort,
        ssrc: videoSSRC,

        srtp_key: request.video.srtp_key,
        srtp_salt: request.video.srtp_salt
      },
      audio: {
        port: audioReturnPort,
        ssrc: audioSSRC,

        srtp_key: request.audio.srtp_key,
        srtp_salt: request.audio.srtp_salt
      }
    };

    this.pendingSessions[request.sessionID] = sessionInfo;
    callback(undefined, response);
  }

  private startStream(request: StartStreamRequest, callback: StreamRequestCallback): void{
    const sessionInfo = this.pendingSessions[request.sessionID];
    const vcodec = this.videoConfig.vcodec || 'libx264';
    const mtu = this.videoConfig.packetSize || 1316; // request.video.mtu is not used
    const mapvideo = this.videoConfig.mapvideo || '0:0';
    const mapaudio = this.videoConfig.mapaudio || '0:1';
    const additionalCommandline = this.videoConfig.additionalCommandline || '-preset ultrafast -tune zerolatency';

    const resolution = this.determineResolution(request.video, this.videoConfig.forceMax);

    const fps = (this.videoConfig.forceMax && this.videoConfig.maxFPS) ||
      (request.video.fps > this.videoConfig.maxFPS) ?
      this.videoConfig.maxFPS : request.video.fps;
    const videoBitrate = (this.videoConfig.forceMax && this.videoConfig.maxBitrate) ||
      (request.video.max_bit_rate > this.videoConfig.maxBitrate) ?
      this.videoConfig.maxBitrate : request.video.max_bit_rate;

    this.log.debug('Video stream requested: ' + request.video.width + ' x ' + request.video.height + ', ' +
      request.video.fps + ' fps, ' + request.video.max_bit_rate + ' kbps', this.name, this.videoConfig.debug);
    this.log.info('Starting video stream: ' + (resolution.width > 0 ? resolution.width : 'native') + ' x ' +
      (resolution.height > 0 ? resolution.height : 'native') + ', ' + (fps > 0 ? fps : 'native') +
      ' fps, ' + (videoBitrate > 0 ? videoBitrate : '???') + ' kbps', this.name);

    let ffmpegArgs = this.videoConfig.source;

    ffmpegArgs += // Video
      ' -map ' + mapvideo +
      ' -codec:v ' + vcodec +
      ' -pix_fmt yuv420p' +
      ' -color_range mpeg' +
      (fps > 0 ? ' -r ' + fps : '') +
      ' -f rawvideo' +
      ' ' + additionalCommandline +
      (vcodec !== 'copy' && resolution.videoFilter ? ' -filter:v ' + resolution.videoFilter : '') +
      (videoBitrate > 0 ? ' -b:v ' + videoBitrate + 'k' : '') +
      ' -payload_type ' + request.video.pt;

    ffmpegArgs += // Video Stream
      ' -ssrc ' + sessionInfo.videoSSRC +
      ' -f rtp' +
      ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
      ' -srtp_out_params ' + sessionInfo.videoSRTP.toString('base64') +
      ' srtp://' + sessionInfo.address + ':' + sessionInfo.videoPort +
      '?rtcpport=' + sessionInfo.videoPort + '&pkt_size=' + mtu;

    if (this.videoConfig.audio) {
      ffmpegArgs += // Audio
        ' -map ' + mapaudio +
        ' -codec:a libfdk_aac' +
        ' -profile:a aac_eld' +
        ' -flags +global_header' +
        ' -f null' +
        ' -ar ' + request.audio.sample_rate + 'k' +
        ' -b:a ' + request.audio.max_bit_rate + 'k' +
        ' -ac 1' +
        ' -payload_type ' + request.audio.pt;

      ffmpegArgs += // Audio Stream
        ' -ssrc ' + sessionInfo.audioSSRC +
        ' -f rtp' +
        ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
        ' -srtp_out_params ' + sessionInfo.audioSRTP.toString('base64') +
        ' srtp://' + sessionInfo.address + ':' + sessionInfo.audioPort +
        '?rtcpport=' + sessionInfo.audioPort + '&pkt_size=188';
    }

    if (this.videoConfig.debug) {
      ffmpegArgs += ' -loglevel level+verbose';
    }

    const socket = createSocket(sessionInfo.addressVersion === 'ipv4' ? 'udp4' : 'udp6');
    socket.on('error', (err: Error) => {
      this.log.error('Socket error: ' + err.name, this.name);
      this.stopStream(request.sessionID);
    });
    socket.on('message', () => {
      if (this.timeout) {
        clearTimeout(this.timeout);
      }
      this.timeout = setTimeout(() => {
        this.log.info('Device appears to be inactive for over 5 seconds. Stopping stream.', this.name);
        this.controller.forceStopStreamingSession(request.sessionID);
        this.stopStream(request.sessionID);
      }, 5000);
    });
    socket.bind(sessionInfo.videoReturnPort, sessionInfo.localAddress);

    const ffmpeg = new FfmpegProcess(this.name, request.sessionID, this.videoProcessor, ffmpegArgs,
      this.log, this.videoConfig.debug, this, callback);

    this.ongoingSessions[request.sessionID] = ffmpeg;
    delete this.pendingSessions[request.sessionID];
  }

  handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback): void {
    switch (request.type) {
      case StreamRequestTypes.START:
        this.startStream(request, callback);
        break;
      case StreamRequestTypes.RECONFIGURE:
        this.log.debug('Received request to reconfigure: ' + request.video.width + ' x ' + request.video.height + ', ' +
          request.video.fps + ' fps, ' + request.video.max_bit_rate + ' kbps (Ignored)', this.name, this.videoConfig.debug);
        callback();
        break;
      case StreamRequestTypes.STOP:
        this.stopStream(request.sessionID);
        callback();
        break;
    }
  }

  public stopStream(sessionId: string): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    try {
      if (this.ongoingSessions[sessionId]) {
        const ffmpegProcess = this.ongoingSessions[sessionId];
        if (ffmpegProcess) {
          ffmpegProcess.stop();
        }
      }
      delete this.ongoingSessions[sessionId];
      this.log.info('Stopped video stream.', this.name);
    } catch (err) {
      this.log.error('Error occurred terminating FFmpeg process: ' + err, this.name);
    }
  }
}
