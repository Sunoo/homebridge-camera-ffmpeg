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
          	"maxStreams": 2,
          	"maxWidth": 1280,
          	"maxHeight": 720,
          	"maxFPS": 30
          }
        }
      ]
    }
