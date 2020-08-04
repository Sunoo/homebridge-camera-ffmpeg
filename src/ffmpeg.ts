import { ChildProcess, spawn } from 'child_process';
import { createSocket } from 'dgram';
import { StreamRequestCallback } from 'homebridge';
import { Logger } from './logger';
import { StreamingDelegate } from './streamingDelegate';

export class FfmpegProcess {
  private readonly process: ChildProcess;
  private killing = false;
  private timeout?: NodeJS.Timeout;

  constructor(name: string, sessionId: string, videoProcessor: string, command: string, log: Logger,
    returnPort: number, debug: boolean, delegate: StreamingDelegate, callback: StreamRequestCallback) {
    let started = false;

    log.debug('Stream command: ' + videoProcessor + ' ' + command, name, debug);

    const socket = createSocket('udp4');
    socket.on('error', (err: Error) => {
      log.error('Socket error: ' + err.name, name);
      delegate.stopStream(sessionId);
    });
    socket.on('message', () => {
      if (this.timeout) {
        clearTimeout(this.timeout);
      }
      this.timeout = setTimeout(() => {
        log.info('Device appears to be inactive for over 5 seconds. Stopping stream.', name);
        delegate.controller.forceStopStreamingSession(sessionId);
        delegate.stopStream(sessionId);
      }, 5000);
    });
    socket.bind(returnPort);

    this.process = spawn(videoProcessor, command.split(/\s+/), { env: process.env });

    if (this.process.stdin) {
      this.process.stdin.on('error', (error: Error) => {
        if (!error.message.includes('EPIPE')) {
          log.error(error.message, name);
        }
      });
    }
    if (this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        if (!started) {
          started = true;
          log.debug('Received first frame.', name, debug);
          if (callback) {
            callback(); // do not forget to execute callback once set up
          }
        }

        if (debug) {
          data.toString().split(/\n/).forEach((line: string) => {
            log.debug(line, name, debug);
          });
        }
      });
    }
    this.process.on('error', (error: Error) => {
      log.error('Failed to start stream: ' + error.message, name);
      if (callback) {
        callback(new Error('ffmpeg process creation failed!'));
        delegate.stopStream(sessionId);
      }
    });
    this.process.on('exit', (code: number, signal: NodeJS.Signals) => {
      const message = 'ffmpeg exited with code: ' + code + ' and signal: ' + signal;

      if (code == null || code === 255) {
        if (this.killing) {
          log.debug(message + ' (Expected)', name, debug);
        } else {
          log.error(message + ' (Unexpected)', name);
        }
      } else {
        log.error(message + ' (Error)', name);
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
    this.killing = true;
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.process.kill('SIGKILL');
  }
}
