---
title: D-Link DCS-933L
author: Agneev Mukherjee
date: 2020-08-24
---
## Main config

This uses MJPEG and no audio and results in little to no delay in playing, however, the video might get jittery.

```json
{
    "name": "Front Gate Camera",
    "manufacturer": "D-Link",
    "model": "DCS-933L",
    "firmwareRevision": "1.15.01",
    "videoConfig": {
        "source": "-re -f mjpeg -i http://user:pass@IP_ADDR/mjpeg.cgi",
        "stillImageSource": "-i http://user:pass@IP_ADDR/image/jpeg.cgi",
        "maxStreams": 6,
        "maxWidth": 0,
        "maxHeight": 0,
        "maxFPS": 0,
        "maxBitrate": 6000,
        "forceMax": true,
        "preserveRatio": true,
        "encoderOptions": "-tune zerolatency"
    }
}
```

## H264 config

This uses H264. There's approx. 5 secs delay at the start, then smooth video throughout.

```json
{
    "videoConfig": {
        "source": "-re -i http://user:pass@IP_ADDR/dgh264.raw"
    }
}
```

## H264 audio config

There's approx 10 secs delay at the start, however audio doesn't cut out. Best option if you want reliable audio and video.

From main config:

```json
{
    "videoConfig": {
        "source": "-re -i http://user:pass@IP_ADDR/dgh264.raw -i http://user:pass@IP_ADDR/dgaudio.cgi",
        "mapaudio": "1:0",
        "audio": true
    }
}
```

## Audio config (using MJPEG)

(Not recommended)

This results in a delay of approx 10 secs. In my testing, I've found that audio would often cut out, so the H264 audio config is the best bet.

From main config:

```json
{
    "videoConfig": {
        "source": "-re -f mjpeg -i http://username:password@IP_ADDR/mjpeg.cgi -i http://user:pass@IP_ADDR/audio.cgi",
        "mapaudio": "1:0",
        "audio": true
    }
}
```

## Additional Information

Tested on Raspberry Pi 4 Ubuntu (64-bit).
