---
layout: config
title: Hikam S5
comment: + Raspberry Pi2
---
- using homebridge-camera-ffmpeg-omx from legotheboss
- removed "-tune zerolatency" from ffmpeg.js (invalid option for my installation)
- low res "rtsp://xxx.xxx.xxx.xxx/onvif2" stream works fine w/ moderate cpu load
- high res "rtsp://xxx.xxx.xxx.xxx/onvif1" stream works w/ cpu load of 150%