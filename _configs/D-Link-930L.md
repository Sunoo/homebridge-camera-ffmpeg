---
layout: config
title: D-Link 930L
---
Tested on Raspberry Pi 3 (with omx)

## config.json

```json
{
	"name": "D-Link Camera",
	"videoConfig": {
		"source": "-re -f mjpeg -i http://admin:password@localip:port/video.cgi",
		"stillImageSource": "-f mjpeg -i http://admin:password@localip:port/image.jpg",
		"maxStreams": 2,
		"maxWidth": 640,
		"maxHeight": 480,
		"maxFPS": 20
	}
}
```
