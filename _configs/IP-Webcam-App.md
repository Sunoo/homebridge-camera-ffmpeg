---
layout: config
title: IP Webcam App
comment: by Pavel Khlebovich
---
Working through http

## config.json

```json
{
   "name":"Bedroom",
   "videoConfig":{
      "source":"-re -i http://src/video -i http://src/audio.opus",
      "stillImageSource":"-i http://src/shot.jpg",
      "maxStreams":2,
      "maxWidth":640,
      "maxHeight":480,
      "maxFPS":30,
      "audio": true,
      "mapvideo": "0",
      "mapaudio": "1"
   }
},
```
