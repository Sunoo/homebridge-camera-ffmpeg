---
title: D-Link DCS 933L
author: Agneev Mukherjee
date: 2020-08-23
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
		"source": "-re -f mjpeg -i http://user:password@10.0.0.20/mjpeg.cgi -i http://user:password@10.0.0.20/audio.cgi",
		"stillImageSource": "-i http://user:password@10.0.0.20/image/jpeg.cgi",
		"maxStreams": 6,
		"maxWidth": 1280,
		"maxHeight": 720,
		"maxFPS": 20,
		"maxBitrate": 6000,
		"minBitrate": 6000,
		"vcodec": "h264_omx",
		"packetSize": 564,
		"videoFilter": "scale=640:480",
		"mapaudio": "1:0",
		"audio": true,
		"debug": false
	}
}
```

## Additional Information

Tested on Raspberry Pi 4. There is a delay while using audio, so turn it off if it's not very important.
