import { ChildProcess, spawn } from 'child_process';
import { StreamRequestCallback } from 'homebridge';
import { Writable } from 'stream';
import { Logger } from './logger';
import { StreamingDelegate } from './streamingDelegate';

interface FfmpegProgress {
  frame?: number;
  fps?: number;
  stream_0_0_q?: number;
  bitrate?: number;
  total_size?: number;
  out_time_us?: number;
  dup_frames?: number;
  drop_frames?: number;
  speed?: number;
}

export class FfmpegProcess {
  private readonly process: ChildProcess;

  constructor(cameraName: string, sessionId: string, videoProcessor: string, ffmpegArgs: string, log: Logger,
    debug = false, delegate: StreamingDelegate, callback?: StreamRequestCallback) {
    log.debug('Stream command: ' + videoProcessor + ' ' + ffmpegArgs, cameraName, debug);

    let started = false;
    const startTime = Date.now();
    this.process = spawn(videoProcessor, ffmpegArgs.split(/\s+/), { env: process.env });

    this.process.stdout?.on('data', () => {
      //const progress = this.parseProgress(data);
      if (!started) {
        started = true;
        if (callback) {
          callback();
        }
        const runtime = (Date.now() - startTime) / 1000;
        const message = 'Getting the first frames took ' + runtime + ' seconds.';
        if (runtime < 5) {
          log.debug(message, cameraName, debug);
        } else if (runtime < 22) {
          log.warn(message, cameraName);
        } else {
          log.error(message, cameraName);
        }
      }
    });
    this.process.stdin?.on('error', (error: Error) => {
      if (!error.message.includes('EPIPE')) {
        log.error(error.message, cameraName);
      }
    });
    if (debug) {
      this.process.stderr?.on('data', (data) => {
        data.toString().split('\n').forEach((line: string) => {
          log.debug(line, cameraName, true);
        });
      });
    }
    this.process.on('error', (error: Error) => {
      log.error('Failed to start stream: ' + error.message, cameraName);
      if (callback) {
        callback(new Error('FFmpeg process creation failed'));
      }
      delegate.stopStream(sessionId);
    });
    this.process.on('exit', (code: number, signal: NodeJS.Signals) => {
      const message = 'FFmpeg exited with code: ' + code + ' and signal: ' + signal;

      if (code == null || code === 255) {
        if (this.process.killed) {
          log.debug(message + ' (Expected)', cameraName, debug);
        } else {
          log.error(message + ' (Unexpected)', cameraName);
        }
      } else {
        log.error(message + ' (Error)', cameraName);
        delegate.stopStream(sessionId);
        if (!started && callback) {
          callback(new Error(message));
        } else {
          delegate.controller.forceStopStreamingSession(sessionId);
        }
      }
    });
  }

  parseProgress(data: Uint8Array): FfmpegProgress | undefined {
    const input = data.toString();

    if (input.indexOf('frame=') == 0) {
      const progress: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
      input.split('\n').forEach((line) => {
        const split = line.split('=', 2);

        const key = split[0];
        const value = parseFloat(split[1]);

        if (!isNaN(value)) {
          progress[key] = value;
        }
      });

      return progress;
    } else {
      return undefined;
    }
  }

  public stop(): void {
    this.process.kill('SIGKILL');
  }

  public getStdin(): Writable | null {
    return this.process.stdin;
  }
}
