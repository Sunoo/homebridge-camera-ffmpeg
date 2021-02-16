import { ChildProcess, spawn } from 'child_process';
import { StreamRequestCallback } from 'homebridge';
import { Writable } from 'stream';
import { Logger } from './logger';
import { StreamingDelegate } from './streamingDelegate';

export class FfmpegProcess {
  private readonly process: ChildProcess;

  constructor(cameraName: string, sessionId: string, videoProcessor: string, ffmpegArgs: string, log: Logger,
    debug = false, delegate: StreamingDelegate, callback?: StreamRequestCallback) {
    log.debug('Stream command: ' + videoProcessor + ' ' + ffmpegArgs, cameraName, debug);

    let started = false;
    this.process = spawn(videoProcessor, ffmpegArgs.split(/\s+/), { env: process.env });

    if (this.process.stdin) {
      this.process.stdin.on('error', (error: Error) => {
        if (!error.message.includes('EPIPE')) {
          log.error(error.message, cameraName);
        }
      });
    }
    if (this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        if (!started) {
          started = true;
          if (callback) {
            callback();
          }
        }

        if (debug) {
          data.toString().split(/\n/).forEach((line: string) => {
            log.debug(line, cameraName, debug);
          });
        }
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

  public stop(): void {
    this.process.kill('SIGKILL');
  }

  public getStdin(): Writable | null {
    return this.process.stdin;
  }
}
