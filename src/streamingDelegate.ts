import {
  API,
  APIEvent,
  CameraController,
  CameraStreamingDelegate,
  HAP,
  Logging,
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
import ip from 'ip';
import { FfmpegProcess } from './ffmpeg';
import { spawn } from 'child_process';
import getPort from 'get-port';
const pathToFfmpeg = require('ffmpeg-for-homebridge'); // eslint-disable-line @typescript-eslint/no-var-requires

type SessionInfo = {
  address: string; // address of the HAP controller

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

export class StreamingDelegate implements CameraStreamingDelegate {
  private readonly hap: HAP;
  private readonly log: Logging;
  private readonly videoConfig: any;
  private readonly videoProcessor: string;
  private readonly interfaceName: string;
  controller?: CameraController;

  // keep track of sessions
  pendingSessions: Record<string, SessionInfo> = {};
  ongoingSessions: Record<string, FfmpegProcess> = {};

  constructor(log: Logging, cameraConfig: any, api: API, hap: HAP,  videoProcessor: string, interfaceName: string) { // eslint-disable-line @typescript-eslint/explicit-module-boundary-types
    this.log = log;
    this.videoConfig = cameraConfig.videoConfig;
    this.hap = hap;

    this.videoProcessor = videoProcessor || pathToFfmpeg || 'ffmpeg';
    this.interfaceName = interfaceName || 'public';

    if (!this.videoConfig.source) {
      throw new Error('Missing source for camera.');
    }

    api.on(APIEvent.SHUTDOWN, () => {
      for (const session in this.ongoingSessions) {
        this.stopStream(session);
      }
    });
  }

  private determineResolution(request: SnapshotRequest | VideoInfo): any {
    const width = request.width > this.videoConfig.maxWidth ? this.videoConfig.maxWidth : request.width;
    const height = request.height > this.videoConfig.maxHeight ? this.videoConfig.maxHeight : request.height;

    let resolution: string;
    switch (this.videoConfig.preserveRatio) {
      case 'W':
        resolution = width + ':-1';
        break;
      case 'H':
        resolution = '-1:' + height;
        break;
      default:
        resolution = width + ':' + height;
        break;
    }


    const vf = [];
    const configFilter = this.videoConfig.videoFilter || null; // null is a valid discrete value
    const videoFilter = configFilter === '' || configFilter === null ? 'scale=' + resolution : configFilter; // empty string or null indicates default
    // In the case of null, skip entirely
    if (videoFilter !== null && videoFilter !== 'none') {
      if (this.videoConfig.vflip) {
        vf.push('hflip');
      }
      if (this.videoConfig.hflip) {
        vf.push('vflip');
      }
      vf.push(videoFilter); // vflip and hflip filters must precede the scale filter to work
    }

    return {width: width, height: height, videoFilter: vf};
  }

  handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback): void {
    const resolution = this.determineResolution(request);

    let fcmd = this.videoConfig.stillImageSource || this.videoConfig.source;

    const ffmpegStillArgs =
      ' -frames:v 1' +
      (resolution.videoFilter.length > 0 ? ' -vf ' + resolution.videoFilter.join(',') : '') +
      ' -f image2 -';

    fcmd += ffmpegStillArgs;

    try {
      const ffmpeg = spawn(
        this.videoProcessor,
        fcmd.split(/\s+/),
        { env: process.env }
      );
      let imageBuffer = Buffer.alloc(0);
      this.log(`Snapshot from ${this.videoConfig.name} (${resolution.width}x${resolution.height})`);
      if (this.videoConfig.debug) {
        this.log(`${this.videoConfig.name} snapshot command: ffmpeg ${fcmd}`);
      }
      ffmpeg.stdout.on('data', function(data: any) {
        imageBuffer = Buffer.concat([imageBuffer, data]);
      });
      const log = this.log;
      const debug = this.videoConfig.debug;
      ffmpeg.on('error', function(error: any) {
        log('An error occurred while making snapshot request');
        debug ? log(error) : null;
      });
      ffmpeg.on(
        'close',
        function(): void {
          callback(undefined, imageBuffer);
        }.bind(this)
      );
    } catch (err) {
      this.log.error(err);
      callback(err);
    }
  }

  async prepareStream(request: PrepareStreamRequest, callback: PrepareStreamCallback): Promise<void> {
    const videoReturnPort = await getPort();
    const videoSSRC = this.hap.CameraController.generateSynchronisationSource();
    const audioReturnPort = await getPort();
    const audioSSRC = this.hap.CameraController.generateSynchronisationSource();

    const sessionInfo: SessionInfo = {
      address: request.targetAddress,

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

    let currentAddress: string;
    try {
      currentAddress = ip.address(this.interfaceName, request.addressVersion); // ipAddress version must match
    } catch {
      this.log.error(`Unable to get ${request.addressVersion} address for ${this.interfaceName}! Falling back to public.`);
      currentAddress = ip.address('public', request.addressVersion); // ipAddress version must match
    }

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
    const fps = request.video.fps > this.videoConfig.maxFPS ? this.videoConfig.maxFPS : request.video.fps;
    const mtu = this.videoConfig.packetSize || 1316; // request.video.mtu is not used
    const mapvideo = this.videoConfig.mapvideo || '0:0';
    const mapaudio = this.videoConfig.mapaudio || '0:1';
    const additionalCommandline = this.videoConfig.additionalCommandline || '-preset ultrafast -tune zerolatency';
    const resolution = this.determineResolution(request.video);

    let videoBitrate = request.video.max_bit_rate;
    if (this.videoConfig.maxBitrate && videoBitrate > this.videoConfig.maxBitrate) {
      videoBitrate = this.videoConfig.maxBitrate;
    } else if (this.videoConfig.minBitrate && videoBitrate < this.videoConfig.minBitrate) {
      videoBitrate = this.videoConfig.minBitrate;
    }
    let audioBitrate = request.audio.max_bit_rate;
    if (this.videoConfig.maxBitrate && audioBitrate > this.videoConfig.maxBitrate) {
      audioBitrate = this.videoConfig.maxBitrate;
    }

    let fcmd = this.videoConfig.source;

    this.log(`Starting ${this.videoConfig.name} video stream(${resolution.width}x${resolution.height}, ${fps} fps, ${videoBitrate} kbps, ${mtu} mtu)...`,
      this.videoConfig.debug ? 'debug enabled' : '');

    const ffmpegVideoArgs =
          ' -map ' + mapvideo +
          ' -vcodec ' + vcodec +
          ' -pix_fmt yuv420p' +
          ' -r ' + fps +
          ' -f rawvideo' +
          ' ' + additionalCommandline +
          (resolution.videoFilter.length > 0 ? ' -vf ' + resolution.videoFilter.join(',') : '') +
          ' -b:v ' + videoBitrate + 'k' +
          ' -bufsize ' + 2 * videoBitrate + 'k' +
          ' -maxrate ' + videoBitrate + 'k' +
          ' -payload_type ' + request.video.pt;

    const ffmpegVideoStream =
          ' -ssrc ' + sessionInfo.videoSSRC +
          ' -f rtp' +
          ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
          ' -srtp_out_params ' + sessionInfo.videoSRTP.toString('base64') +
          ' srtp://' + sessionInfo.address + ':' + sessionInfo.videoPort +
          '?rtcpport=' + sessionInfo.videoPort +'&localrtcpport=' + sessionInfo.videoPort + '&pkt_size=' + mtu;

    // build required video arguments
    fcmd += ffmpegVideoArgs;
    fcmd += ffmpegVideoStream;

    // build optional audio arguments
    if (this.videoConfig.audio) {
      const ffmpegAudioArgs =
            ' -map ' + mapaudio +
            ' -acodec libfdk_aac' +
            ' -profile:a aac_eld' +
            ' -flags +global_header' +
            ' -f null' +
            ' -ar ' + request.audio.sample_rate + 'k' +
            ' -b:a ' + audioBitrate + 'k' +
            ' -bufsize ' + audioBitrate + 'k' +
            ' -ac 1' +
            ' -payload_type ' + request.audio.pt;

      const ffmpegAudioStream =
            ' -ssrc ' + sessionInfo.audioSSRC +
            ' -f rtp' +
            ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
            ' -srtp_out_params ' + sessionInfo.audioSRTP.toString('base64') +
            ' srtp://' + sessionInfo.address + ':' + sessionInfo.audioPort +
            '?rtcpport=' + sessionInfo.audioPort + '&localrtcpport=' + sessionInfo.audioPort + '&pkt_size=188';

      fcmd += ffmpegAudioArgs;
      fcmd += ffmpegAudioStream;
    }

    if (this.videoConfig.debug) {
      fcmd += ' -loglevel level+verbose';
    }

    const ffmpeg = new FfmpegProcess(
      this.videoConfig.name,
      request.sessionID,
      this.videoProcessor,
      fcmd,
      this.log,
      sessionInfo.videoReturnPort,
      this.videoConfig.debug,
      this,
      callback
    );

    this.ongoingSessions[request.sessionID] = ffmpeg;
    delete this.pendingSessions[request.sessionID];
  }

  handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback): void {
    switch (request.type) {
      case StreamRequestTypes.START:
        this.startStream(request, callback);
        break;
      case StreamRequestTypes.RECONFIGURE:
        // not implemented
        this.log.debug('Received (unsupported) request to reconfigure to: ' + JSON.stringify(request.video));
        callback();
        break;
      case StreamRequestTypes.STOP:
        this.stopStream(request.sessionID);
        callback();
        break;
    }
  }

  public stopStream(sessionId: string): void {
    try {
      if (this.ongoingSessions[sessionId]) {
        const ffmpegProcess = this.ongoingSessions[sessionId];
        if (ffmpegProcess) {
          ffmpegProcess.stop();
        }
      }
      delete this.ongoingSessions[sessionId];
      this.log(`Stopped ${this.videoConfig.name} video stream!`);
    } catch (e) {
      this.log.error('Error occurred terminating the video process!');
      this.log.error(e);
    }
  }
}
