# homebridge-camera-ffmpeg

ffmpeg plugin for [Homebridge](https://github.com/nfarina/homebridge)

## Installation

1. Install ffmpeg on your Mac
2. Install this plugin using: npm install -g homebridge-camera-ffmpeg
3. Edit ``config.json`` and add the camera.
3. Run Homebridge
4. Add extra camera accessories in Home app. The setup code is the same as homebridge.

### Config.json Example

    {
      "platform": "Camera-ffmpeg",
      "cameras": [
        {
          "name": "Camera Name",
          "videoConfig": {
          	"source": "-re -i rtsp://myfancy_rtsp_stream",
            "stillImageSource": "-i http://faster_still_image_grab_url/this_is_optional.jpg",
          	"maxStreams": 2,
          	"maxWidth": 1280,
          	"maxHeight": 720,
          	"maxFPS": 30
          }
        }
      ]
    }

## Tested configurations

We have started collecting tested configurations in the wiki, so please before raising an issue with your configuration, please check the [wiki](https://github.com/KhaosT/homebridge-camera-ffmpeg/wiki).  Also if you a working configuration that you would like to share, please add it to the [wiki](https://github.com/KhaosT/homebridge-camera-ffmpeg/wiki).

https://github.com/KhaosT/homebridge-camera-ffmpeg/wiki

