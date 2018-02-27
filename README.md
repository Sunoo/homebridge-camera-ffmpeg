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

#### Optional Parameters

* `vcodec`, if your running on a RPi with the omx version of ffmpeg installed, you can change to the hardware accelerated video codec with this option.
* `audio`, can be set to true to enable audio streaming from camera. To use audio ffmpeg must be compiled with --enable-libfdk-aac, see http://praveen.life/2016/06/26/compile-ffmpeg-for-raspberry-pi-3/
* `packetSize`, can be set to a multiple of 188, default 1316. If audio or video is choppy try a smaller value.

```
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
      	"maxFPS": 30,
      	"vcodec": "h264_omx",
        "audio": true,
        "packetSize": 188
      }
    }
  ]
}
```

## Uploading to Google Drive of Still Images ( Snapshots )

This is an optional feature that will automatically store every snapshot taken to your Google Drive account as a photo.  This is very useful if you have motion sensor in the same room as the camera, as it will take a snapshot of whatever caused the motion sensor to trigger, and store the image on Google Drive and create a Picture Notification on your iOS device.

The snapshots are stored in a folder called "Camera Pictures", and are named with camera name, date and time of the image.

To enable this feature, please add a new config option "uploader", and follow the steps below.

* Add the option "uploader" to your config.json i.e.

```
{
  "platform": "Camera-ffmpeg",
  "cameras": [
    {
      "name": "Camera Name",
      "uploader": true,
      "videoConfig": {
      	"source": "-re -i rtsp://myfancy_rtsp_stream",
        "stillImageSource": "-i http://faster_still_image_grab_url/this_is_optional.jpg",
      	"maxStreams": 2,
      	"maxWidth": 1280,
      	"maxHeight": 720,
      	"maxFPS": 30,
      	"vcodec": "h264_omx"            
      }
    }
  ]
}
```

If the option is missing, it defaults to false, and does not enable the uploader.

* For the setup of Google Drive, please follow the Google Drive Quickstart for Node.js instructions from here except for these changes.

https://developers.google.com/drive/v3/web/quickstart/nodejs

* In Step 1-h the working directory should be the .homebridge directory
* Skip Step 2 and 3
* And in step 4, use the quickstart.js included in the plugin itself.  And to do this you need to run the command from the plugin directory.  Then just follow steps a to c

## Tested configurations

We have started collecting tested configurations in the wiki, so please before raising an issue with your configuration, please check the [wiki](https://github.com/KhaosT/homebridge-camera-ffmpeg/wiki).  Also if you have a working configuration that you would like to share, please add it to the [wiki](https://github.com/KhaosT/homebridge-camera-ffmpeg/wiki).

https://github.com/KhaosT/homebridge-camera-ffmpeg/wiki
