---
title: Helper Plugins
order: 4
---
Because many cameras do not natively support MQTT or HTTP calls in the format Homebridge Camera FFmpeg uses, additional plugins have been written by various developers to add support for methods used by various cameras. 

#### MQTT-based Helper Plugins

- [homebridge-dafang-mqtt-republish](https://www.npmjs.com/package/homebridge-dafang-mqtt-republish) by Sunoo: Cameras running [Dafang Hacks](https://github.com/EliasKotlyar/Xiaomi-Dafang-Hacks). Can also expose various additional fuctionality of these cameras.

#### HTTP-based Helper Plugins

- [homebridge-ftp-motion](https://www.npmjs.com/package/homebridge-ftp-motion) by Sunoo: Any camera that supports uploading to FTP.
- [homebridge-smtp-motion](https://www.npmjs.com/package/homebridge-smtp-motion) by Sunoo: Any camera that can send emails over SMTP.

If you know of any additional plugins that add support for other cameras, please [open an Issue](https://github.com/Sunoo/homebridge-camera-ffmpeg/issues) and it will be added to this list.
