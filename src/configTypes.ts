export type FfmpegPlatformConfig = {
  name: string;
  videoProcessor: string;
  interfaceName: string;
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
  unbridge: boolean;
  videoConfig: VideoConfig;
};

export type VideoConfig = {
  source: string;
  stillImageSource: string;
  returnAudioTarget: string;
  maxStreams: number;
  maxWidth: number;
  maxHeight: number;
  maxFPS: number;
  maxBitrate: number;
  forceMax: boolean;
  vcodec: string;
  packetSize: number;
  videoFilter: string;
  encoderOptions: string;
  mapvideo: string;
  mapaudio: string;
  audio: boolean;
  debug: boolean;
  debugReturn: boolean;
};