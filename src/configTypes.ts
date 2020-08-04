export type FfmpegPlatformConfig = {
  name: string;
  videoProcessor: string;
  mqtt: string;
  portmqtt: number;
  usermqtt: string;
  passmqtt: string;
  topic: string;
  porthttp: number;
  localhttp: boolean;
  cameras: Array<CameraConfig>;
};

export type CameraConfig = {
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareRevision: string;
  motion: boolean;
  doorbell: boolean;
  switches: boolean;
  motionTimeout: number;
  videoConfig: VideoConfig;
};

export type VideoConfig = {
  source: string;
  stillImageSource: string;
  maxStreams: number;
  maxWidth: number;
  maxHeight: number;
  maxFPS: number;
  maxBitrate: number;
  minBitrate: number;
  preserveRatio: string;
  vcodec: string;
  packetSize: number;
  videoFilter: string;
  additionalCommandline: string;
  mapvideo: string;
  mapaudio: string;
  audio: boolean;
  vflip: boolean;
  hflip: boolean;
  debug: boolean;
};