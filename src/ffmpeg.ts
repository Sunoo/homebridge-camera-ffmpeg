import { ChildProcess, spawn } from 'child_process';
import { StreamRequestCallback } from 'homebridge';
import { Logger } from './logger';
import { StreamingDelegate } from './streamingDelegate';

export class FfmpegProcess {
  private readonly process: ChildProcess;

  constructor(cameraName: string, sessionId: string, videoProcessor: string, ffmpegArgs: string,
    log: Logger, debug: boolean, delegate: StreamingDelegate, callback: StreamRequestCallback) {
    let started = false;

    log.debug('Stream command: ' + videoProcessor + ' ' + ffmpegArgs, cameraName, debug);

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
          callback(); // do not forget to execute callback once set up
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
      callback(new Error('FFmpeg process creation failed!'));
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
        if (!started) {
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
}
