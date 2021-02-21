import { PlatformIdentifier, PlatformName } from 'homebridge';

export type FfmpegPlatformConfig = {
  platform: PlatformName | PlatformIdentifier;
  name?: string;
  videoProcessor?: string;
  mqtt?: string;
  portmqtt?: number;
  tlsmqtt?: boolean;
  usermqtt?: string;
  passmqtt?: string;
  porthttp?: number;
  localhttp?: boolean;
  cameras?: Array<CameraConfig>;
};

export type CameraConfig = {
  name?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  firmwareRevision?: string;
  motion?: boolean;
  doorbell?: boolean;
  switches?: boolean;
  motionTimeout?: number;
  motionDoorbell?: boolean;
  mqtt?: MqttCameraConfig;
  unbridge?: boolean;
  videoConfig?: VideoConfig;
};

export type VideoConfig = {
  source?: string;
  stillImageSource?: string;
  returnAudioTarget?: string;
  maxStreams?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxFPS?: number;
  maxBitrate?: number;
  forceMax?: boolean;
  vcodec?: string;
  packetSize?: number;
  videoFilter?: string;
  encoderOptions?: string;
  mapvideo?: string;
  mapaudio?: string;
  audio?: boolean;
  debug?: boolean;
  debugReturn?: boolean;
};

export type MqttCameraConfig = {
  motionTopic?: string;
  motionMessage?: string;
  motionResetTopic?: string;
  motionResetMessage?: string;
  doorbellTopic?: string;
  doorbellMessage?: string;
};
