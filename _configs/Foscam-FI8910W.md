---
layout: config
title: Foscam FI8910W
---
Streaming via http

```json
{
  "platform": "Camera-ffmpeg",
  "cameras": [
  {
      "name": "Camera",
      "videoConfig": {
      	"source": "-re -i http://user:pass@10.0.1.131:8090/videostream.asf?user=user&pwd=pass&resolution=320x240",
        "stillImageSource": "-i http://user:pass@10.0.1.131:8090/snapshot.jpg?user=user&pwd=pass&strm=0",
      	"maxStreams": 2,
      	"maxWidth": 1280,
      	"maxHeight": 720,
      	"maxFPS": 30
      }
    }
  ]
}
```
