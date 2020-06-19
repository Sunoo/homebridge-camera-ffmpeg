import { ChildProcess, spawn } from 'child_process';
import { Logging, StreamRequestCallback } from 'homebridge';
import { StreamingDelegate } from './streamingDelegate';
import { Readable, Writable } from 'stream';

const pathToFfmpeg = require('ffmpeg-for-homebridge'); // eslint-disable-line @typescript-eslint/no-var-requires

export class FfmpegProcess {
  private ff: ChildProcess;

  constructor(
    title: string,
    command: string,
    log: Logging,
    callback: StreamRequestCallback | undefined,
    delegate: StreamingDelegate,
    sessionId: string,
    ffmpegDebugOutput: boolean,
    customFfmpeg?: string,
  ) {
    let started = false;
    const controller = delegate.controller;

    if (ffmpegDebugOutput) {
      log(`${title} command: ffmpeg ${command}`);
    }

    const videoProcessor = customFfmpeg || pathToFfmpeg || 'ffmpeg';
    this.ff = spawn(videoProcessor, command.split(' '), { env: process.env });

    if (this.ff.stdin) {
      this.ff.stdin.on('error', (error) => {
        if (!error.message.includes('EPIPE')) {
          log.error(error.message);
        }
      });
    }
    if (this.ff.stderr) {
      this.ff.stderr.on('data', (data) => {
        if (!started) {
          started = true;
          log.debug(`${title}: received first frame`);
          if (callback) {
            callback(); // do not forget to execute callback once set up
          }
        }

        if (ffmpegDebugOutput) {
          log(`${title}: ${String(data)}`);
        }
      });
    }
    this.ff.on('error', (error) => {
      log.error(`[${title}] Failed to start stream: ` + error.message);
      if (callback) {
        callback(new Error('ffmpeg process creation failed!'));
        delegate.stopStream(sessionId);
      }
    });
    this.ff.on('exit', (code, signal) => {
      const message = `[${title}] ffmpeg exited with code: ${code} and signal: ${signal}`;

      if (code == null || code === 255) {
        log.debug(message + ` (${title} Stream stopped!)`);
      } else {
        log.error(message + ' (error)');
        delegate.stopStream(sessionId);
        if (!started && callback) {
          callback(new Error(message));
        } else if (controller) {
          controller.forceStopStreamingSession(sessionId);
        }
      }
    });
  }

  public stop(): void {
    this.ff.kill('SIGKILL');
  }

  public getStdin(): Writable | null {
    return this.ff.stdin;
  }

  public getStdout(): Readable | null {
    return this.ff.stdout;
  }
}
