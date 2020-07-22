import { Logging } from 'homebridge';

export class Logger {
  private readonly log: Logging;
  private readonly debugMode: boolean;

  constructor(log: Logging) {
    this.log = log;
    this.debugMode = process.argv.includes('-D') || process.argv.includes('--debug');
  }

  public info(message: string): void {
    this.log.info(message);
  }

  public warn(message: string): void {
    this.log.warn(message);
  }

  public error(message: string): void {
    this.log.error(message);
  }

  public debug(message: string, alwaysLog = false): void {
    if (this.debugMode) {
      this.log.debug(message);
    } else if (alwaysLog) {
      this.log.info(message);
    }
  }
}