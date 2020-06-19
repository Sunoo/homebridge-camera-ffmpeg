import {
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
  StreamingRequest,
  StreamRequestCallback,
  StreamRequestTypes,
  StreamSessionIdentifier,
  VideoInfo,
  AudioInfo,
} from 'homebridge';
import ip from 'ip';
import { FfmpegProcess } from './ffmpeg';
import { spawn } from 'child_process';

const pathToFfmpeg = require('ffmpeg-for-homebridge'); // eslint-disable-line @typescript-eslint/no-var-requires

type SessionInfo = {
  address: string; // address of the HAP controller

  videoPort: number;
  videoCryptoSuite: SRTPCryptoSuites; // should be saved if multiple suites are supported
  videoSRTP: Buffer; // key and salt concatenated
  videoSSRC: number; // rtp synchronisation source

  audioPort: number;
  audioCryptoSuite: SRTPCryptoSuites;
  audioSRTP: Buffer;
  audioSSRC: number;
};

// const FFMPEGH264ProfileNames = [
//   'baseline',
//   'main',
//   'high'
// ];
// const FFMPEGH264LevelNames = [
//   '3.1',
//   '3.2',
//   '4.0'
// ];

export class StreamingDelegate implements CameraStreamingDelegate {
  private readonly hap: HAP;
  private readonly log: Logging;
  private debug = false;
  private ffmpegOpt: any;
  private videoProcessor = '';
  private name = '';
  controller?: CameraController;

  // keep track of sessions
  pendingSessions: Record<string, SessionInfo> = {};
  ongoingSessions: Record<string, FfmpegProcess> = {};

  constructor(hap: HAP, cameraConfig: any, log: Logging, videoProcessor: string) {
    this.hap = hap;
    this.log = log;
    this.ffmpegOpt = cameraConfig.videoConfig;
    this.name = cameraConfig.name;
    this.videoProcessor = videoProcessor || pathToFfmpeg || 'ffmpeg';
    this.debug = this.ffmpegOpt.debug;

    if (!this.ffmpegOpt.source) {
      throw new Error('Missing source for camera.');
    }
  }

  handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback): void {
    const width = request.width > this.ffmpegOpt.maxWidth ? this.ffmpegOpt.maxWidth : request.width;
    const height = request.height > this.ffmpegOpt.maxHeight ? this.ffmpegOpt.maxHeight : request.height;
    const filter = this.ffmpegOpt.videoFilter || null;
    const vflip = this.ffmpegOpt.vflip || false;
    const hflip = this.ffmpegOpt.hflip || false;

    let resolution: string;
    switch (this.ffmpegOpt.preserveRatio) {
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
    const videoFilter = filter === '' || filter === null ? 'scale=' + resolution : filter; // empty string or null indicates default
    // In the case of null, skip entirely
    if (videoFilter !== null && videoFilter !== 'none') {
      if (hflip) {
        vf.push('hflip');
      }

      if (vflip) {
        vf.push('vflip');
      }

      vf.push(videoFilter); // vflip and hflip filters must precede the scale filter to work
    }
    const imageSource = this.ffmpegOpt.stillImageSource || this.ffmpegOpt.source;

    try {
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
      ffmpeg.stdout.on('data', function (data: any) {
        imageBuffer = Buffer.concat([imageBuffer, data]);
      });
      const log = this.log;
      const debug = this.debug;
      ffmpeg.on('error', function (error: any) {
        log('An error occurred while making snapshot request');
        debug ? log(error) : null;
      });
      ffmpeg.on(
        'close',
        function (): void {
          callback(undefined, imageBuffer);
        }.bind(this),
      );
    } catch (err) {
      this.log.error(err);
      callback(err);
    }
  }

  prepareStream(request: PrepareStreamRequest, callback: PrepareStreamCallback): void {
    const sessionId: StreamSessionIdentifier = request.sessionID;
    const targetAddress = request.targetAddress;

    //video stuff
    const video = request.video;
    const videoPort = video.port;

    const videoCryptoSuite = video.srtpCryptoSuite; // could be used to support multiple crypto suite (or support no suite for debugging)
    const videoSrtpKey = video.srtp_key;
    const videoSrtpSalt = video.srtp_salt;

    const videoSSRC = this.hap.CameraController.generateSynchronisationSource();

    //audio stuff
    const audio = request.audio;
    const audioPort = audio.port;

    const audioCryptoSuite = audio.srtpCryptoSuite; // could be used to support multiple crypto suite (or support no suite for debugging)
    const audioSrtpKey = audio.srtp_key;
    const audioSrtpSalt = audio.srtp_salt;

    const audioSSRC = this.hap.CameraController.generateSynchronisationSource();

    const sessionInfo: SessionInfo = {
      address: targetAddress,

      videoPort: videoPort,
      videoCryptoSuite: videoCryptoSuite,
      videoSRTP: Buffer.concat([videoSrtpKey, videoSrtpSalt]),
      videoSSRC: videoSSRC,

      audioPort: audioPort,
      audioCryptoSuite: audioCryptoSuite,
      audioSRTP: Buffer.concat([audioSrtpKey, audioSrtpSalt]),
      audioSSRC: audioSSRC,
    };

    const currentAddress = ip.address('public', request.addressVersion); // ipAddress version must match
    const response: PrepareStreamResponse = {
      address: currentAddress,
      video: {
        port: videoPort,
        ssrc: videoSSRC,

        srtp_key: videoSrtpKey,
        srtp_salt: videoSrtpSalt,
      },
      audio: {
        port: audioPort,
        ssrc: audioSSRC,

        srtp_key: audioSrtpKey,
        srtp_salt: audioSrtpSalt,
      },
    };

    this.pendingSessions[sessionId] = sessionInfo;
    callback(void 0, response);
  }

  handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback): void {
    const sessionId = request.sessionID;

    switch (request.type) {
      case StreamRequestTypes.START:
        const vcodec = this.ffmpegOpt.vcodec || 'libx264';
        const acodec = this.ffmpegOpt.acodec || 'libfdk_aac';
        const additionalCommandline = this.ffmpegOpt.additionalCommandline || '-preset ultrafast -tune zerolatency';
        const mapvideo = this.ffmpegOpt.mapvideo || '0:0';
        const mapaudio = this.ffmpegOpt.mapaudio || '0:1';

        const sessionInfo = this.pendingSessions[sessionId];
        const video: VideoInfo = request.video;
        const audio: AudioInfo = request.audio;

        // const profile = FFMPEGH264ProfileNames[video.profile];
        // const level = FFMPEGH264LevelNames[video.level];
        const width = video.width > this.ffmpegOpt.maxWidth ? this.ffmpegOpt.maxWidth : video.width;
        const height = video.height > this.ffmpegOpt.maxHeight ? this.ffmpegOpt.maxHeight : video.height;
        const fps = video.fps > this.ffmpegOpt.maxFPS ? this.ffmpegOpt.maxFPS : video.fps;
        const vflip = this.ffmpegOpt.vflip || false;
        const hflip = this.ffmpegOpt.hflip || false;

        let resolution: string;
        switch (this.ffmpegOpt.preserveRatio) {
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

        const videoPayloadType = video.pt;
        const audioPayloadType = audio.pt;
        let videoMaxBitrate = video.max_bit_rate;
        if (videoMaxBitrate > this.ffmpegOpt.maxBitrate) {
          videoMaxBitrate = this.ffmpegOpt.maxBitrate;
        }
        let audioMaxBitrate = audio.max_bit_rate;
        if (audioMaxBitrate > this.ffmpegOpt.maxBitrate) {
          audioMaxBitrate = this.ffmpegOpt.maxBitrate;
        }
        // const rtcpInterval = video.rtcp_interval; // usually 0.5
        const sampleRate = audio.sample_rate;
        const mtu = video.mtu; // maximum transmission unit

        const address = sessionInfo.address;
        const videoPort = sessionInfo.videoPort;
        const audioPort = sessionInfo.audioPort;
        const videoSsrc = sessionInfo.videoSSRC;
        const audioSsrc = sessionInfo.audioSSRC;
        // const cryptoSuite = sessionInfo.videoCryptoSuite;
        const videoSRTP = sessionInfo.videoSRTP.toString('base64');
        const audioSRTP = sessionInfo.audioSRTP.toString('base64');
        const filter = this.ffmpegOpt.videoFilter || null;
        const vf = [];

        const videoFilter = filter === '' || filter === null ? 'scale=' + resolution : filter; // empty string or null indicates default
        // In the case of null, skip entirely
        if (videoFilter !== null && videoFilter !== 'none' && vcodec !== 'copy') {
          // Filters cannot be set if the copy vcodec is used.
          vf.push(videoFilter);

          if (hflip) vf.push('hflip');

          if (vflip) vf.push('vflip');
        }

        let fcmd = this.ffmpegOpt.source;

        this.log.debug(
          `Starting video stream (${width}x${height}, ${fps} fps, ${videoMaxBitrate} kbps, ${mtu} mtu)...`,
        );

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
          videoMaxBitrate +
          'k' +
          ' -bufsize ' +
          2 * videoMaxBitrate +
          'k' +
          ' -maxrate ' +
          videoMaxBitrate +
          'k' +
          ' -payload_type ' +
          videoPayloadType;

        const ffmpegVideoStream =
          ' -ssrc ' +
          videoSsrc +
          ' -f rtp' +
          ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
          ' -srtp_out_params ' +
          videoSRTP +
          ' srtp://' +
          address +
          ':' +
          videoPort +
          '?rtcpport=' +
          videoPort +
          '&localrtcpport=' +
          videoPort +
          '&pkt_size=' +
          mtu;

        // build required video arguments
        fcmd += ffmpegVideoArgs;
        fcmd += ffmpegVideoStream;

        // build optional audio arguments
        if (this.ffmpegOpt.audio) {
          const ffmpegAudioArgs =
            ' -map ' +
            mapaudio +
            ' -acodec ' +
            acodec +
            ' -profile:a aac_eld' +
            ' -flags +global_header' +
            ' -f null' +
            ' -ar ' +
            sampleRate +
            'k' +
            ' -b:a ' +
            audioMaxBitrate +
            'k' +
            ' -bufsize ' +
            audioMaxBitrate +
            'k' +
            ' -ac 1' +
            ' -payload_type ' +
            audioPayloadType;

          const ffmpegAudioStream =
            ' -ssrc ' +
            audioSsrc +
            ' -f rtp' +
            ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
            ' -srtp_out_params ' +
            audioSRTP +
            ' srtp://' +
            address +
            ':' +
            audioPort +
            '?rtcpport=' +
            audioPort +
            '&localrtcpport=' +
            audioPort +
            '&pkt_size=188';

          fcmd += ffmpegAudioArgs;
          fcmd += ffmpegAudioStream;
        }

        if (this.debug) {
          fcmd += ' -loglevel debug';
        }

        const ffmpeg = new FfmpegProcess(
          'FFMPEG',
          fcmd,
          this.log,
          callback,
          this,
          sessionId,
          false,
          this.videoProcessor,
        );

        this.ongoingSessions[sessionId] = ffmpeg;
        delete this.pendingSessions[sessionId];
        break;
      case StreamRequestTypes.RECONFIGURE:
        // not implemented
        this.log.debug('Received (unsupported) request to reconfigure to: ' + JSON.stringify(request.video));
        callback();
        break;
      case StreamRequestTypes.STOP:
        this.stopStream(sessionId);
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
      this.log.debug('Stopped streaming session!');
    } catch (e) {
      this.log.error('Error occurred terminating the video process!');
      this.log.error(e);
    }
  }
}
