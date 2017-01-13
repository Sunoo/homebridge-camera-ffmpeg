# homebridge-camera-ffmpeg-omx

ffmpeg plugin for [Homebridge](https://github.com/nfarina/homebridge). Optimized for Rapsberry Pi via GPU encoding

## Installation

1. Install ffmpeg on your Raspberry Pi.
    
    a. Download this package: `sudo wget goo.gl/gMGA81 -O ffmpeg.deb`
    
    b. Install this package: `sudo dpkg -i ffmpeg.deb`
    
    c. Ensure that the user you are running homebridge as has access to /dev/vchiq.  ie `sudo usermod -aG video login` where login is the user you are running homebridge as. 

2. Install this plugin using: npm install -g homebridge-camera-ffmpeg-omx
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

Incidentally, check [iSpyConnect's camera database](https://www.ispyconnect.com/sources.aspx) to find likely protocols and URLs to try with your camera.
