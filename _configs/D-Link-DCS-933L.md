---
title: D-Link DCS 933L
author: Agneev Mukherjee
date: 2020-08-24
---
## Homebridge Config

```json
{
	"name": "Front Gate Camera",
	"manufacturer": "D-Link",
	"model": "DCS-933L",
	"firmwareRevision": "1.15.01",
	"motion": false,
	"videoConfig": {
		"source": "-re -f mjpeg -i http://username:password@10.0.0.20/mjpeg.cgi -i http://username:password@10.0.0.20/audio.cgi",
		"stillImageSource": "-i http://username:password@10.0.0.20/image/jpeg.cgi",
		"maxStreams": 6,
		"maxWidth": 0,
		"maxHeight": 0,
		"maxFPS": 0,
		"maxBitrate": 6000,
		"forceMax": true,
		"preserveRatio": true,
		"vcodec": "h264_omx",
		"mapaudio": "1:0",
		"audio": true,
		"debug": false
	}
}
```

## Additional Information

Tested on Raspberry Pi 4. There is a delay while using audio, so turn it off if it's not very important.
