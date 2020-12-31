---
title: Hikvision DS-2CD2T22WD-I5 and DS-2CD2322WD-I
comment: firmware V5.5.82 build 190909
author: r8plicant
date: 2020-12-25
---
**Homebridge Config**

```json
{
	"name": "Camera Front Door",
	"videoConfig": {
		"source": "-i rtsp://user:password@192.168.0.2/ISAPI/Streaming/channels/101/HighResolutionVideo",
		"stillImageSource": "http://user:password@192.168.0.2/ISAPI/Streaming/channels/101/picture"
	}
}
```

**Additional Information**

There are other APIs that work as well, such as rtsp://user:password@192.168.0.2/ISAPI/Streaming/channels/101/ for example, but I found this work to work best for me. The still image Source is not updated automatically on homekit, but the live stream works nice.
