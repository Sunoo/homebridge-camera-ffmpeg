<span align="center">

<a href="https://github.com/homebridge/verified/blob/master/verified-plugins.json"><img alt="homebridge-verified" src="https://github.com/homebridge/branding/blob/master/logos/homebridge-color-round.svg?sanitize=true" width="140px"></a>

# Homebridge Camera FFmpeg

<a href="https://www.npmjs.com/package/homebridge-camera-ffmpeg"><img title="npm version" src="https://badgen.net/npm/v/homebridge-camera-ffmpeg" ></a>
<a href="https://www.npmjs.com/package/homebridge-camera-ffmpeg"><img title="npm downloads" src="https://badgen.net/npm/dt/homebridge-camera-ffmpeg" ></a>

<p><a href="https://www.ffmpeg.org">FFmpeg</a> plugin for
  <a href="https://homebridge.io">Homebridge</a>.
</p>

</span>

## Installation

Basic Installation:

1. Install this plugin using: `npm install -g --unsafe-perm homebridge-camera-ffmpeg`
2. Edit `config.json` and add the camera.

Install via Homebridge Config UI X:

1. Search for `Camera FFmpeg` on the plugin screen of the [Homebridge UI](https://github.com/oznu/homebridge-config-ui-x).
2. Install the `homebridge-camera-ffmpeg` and use the form to enter your camera settings.

After restarting Homebridge, each camera you defined will need to be manually paired in the Home app, to do this:

1. Open the Home <img src="https://user-images.githubusercontent.com/3979615/78010622-4ea1d380-738e-11ea-8a17-e6a465eeec35.png" height="16.42px"> app on your device.
2. Tap the Home tab, then tap <img src="https://user-images.githubusercontent.com/3979615/78010869-9aed1380-738e-11ea-9644-9f46b3633026.png" height="16.42px">.
3. Tap *Add Accessory*, and select *I Don't Have a Code or Cannot Scan*.
4. Select the Camera you want to pair.
5. Enter the Homebridge PIN, this can be found under the QR code in Homebridge UI or your Homebridge logs, alternatively you can select *Use Camera* and scan the QR code again.

## Configuration

#### Config.json Example

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

* `uploader` enable uploading of snapshots to Google Photo's, defaults to `false`.
* `username` Google Photo's account username
* `password` Google Photo's account password
* `album` Google Photo's Album, defaults to `Camera Pictures`
* `motion` enable a dummy switch and motion sensor to trigger picture notifications in iOS 13, defaults to `false`.  See wiki for more detailed instructions.
* `doorbell` enable doorbell function for this camera (image notifications). When enabled there will be an additional switch that triggers the doorbell event, automate it to use it with other HomeKit switches, HTTP events etc.
* `manufacturer` set manufacturer name for display in the Home app
* `model` set model for display in the Home app
* `serialNumber` set serial number for display in the Home app
* `firmwareRevision` set firmware revision for display in the Home app

##### Example with manufacturer, model, serial number and firmware set:

```
{
  "platform": "Camera-ffmpeg",
  "cameras": [
    {
      "name": "Camera Name",
      "manufacturer": "ACME, Inc.",
      "model": "ABC-123",
      "serialNumber": "1234567890",
      "firmwareRevision": "1.0",
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
```

##### Example with uploading to Google Photo's upload enabled

```
{
  "platform": "Camera-ffmpeg",
  "cameras": [
    {
      "name": "Camera Name",
      "uploader": true,
      "username": "xxxxxxxxx@gmail.com",
      "password": "xxxxxxxxxxx",
      "album": "Test Album",
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
```

I would not recommend using your primary Google Photo's account for this, but create a separate account, then share the Photo Album with your primary account.

Please note, this requires the Chromium browser installed, please ensure that it is installed before starting configuration. And a minimum of Rasbian Stretch on a RPI.

```
sudo apt-get install chromium-browser
```

#### Optional videoConfig Parameters

* `maxStreams` is the maximum number of streams that will be generated for this camera, default 2
* `maxWidth` is the maximum width reported to HomeKit, default `1280`
* `maxHeight` is the maximum height reported to HomeKit, default `720`
* `maxFPS` is the maximum frame rate of the stream, default `10`
* `minBitrate` is the minimum bit rate of the stream in kbit/s, default `0`
* `maxBitrate` is the maximum bit rate of the stream in kbit/s, default `300`
* `preserveRatio` can be set to either `W` or `H` with respective obvious meanings, all other values have no effect
* `vcodec` If you're running on a RPi with the omx version of ffmpeg installed, you can change to the hardware accelerated video codec with this option, default `libx264`
* `audio` can be set to true to enable audio streaming from camera, default `false`.
* `acodec` Default audio codec is `libfdk_aac` and is enabled in the bundled ffmpeg version.
* `packetSize` If audio or video is choppy try a smaller value, set to a multiple of 188, default `1316`
* `vflip` Flips the stream vertically, default `false`
* `hflip` Flips the stream horizontally, default `false`
* `mapvideo` Select the stream used for video, default `0:0`
* `mapaudio` Select the stream used for audio, default `0:1`
* `videoFilter` Allows a custom video filter to be passed to FFmpeg via `-vf`, defaults to `scale=1280:720`
* `additionalCommandline` Allows additional of extra command line options to FFmpeg, for example `'-loglevel verbose'`
* `debug` Show the output of ffmpeg in the log, default `false`

A somewhat complicated example:

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
        "maxBitrate": 200,
        "vcodec": "h264_omx",
        "audio": false,
        "packetSize": 188,
        "hflip": true,
        "additionalCommandline": "-x264-params intra-refresh=1:bframes=0",
        "debug": true
      }
    }
  ]
}
```

#### Using another Video Processor

* `videoProcessor` is the video processor used to manage videos. eg: ffmpeg (by default) or avconv or /a/path/to/another/ffmpeg. Need to use the same parameters than ffmpeg.

```
{
  "platform": "Camera-ffmpeg",
  "videoProcessor": "avconv",
  "cameras": [
    ...
  ]
}
```

```
{
  "platform": "Camera-ffmpeg",
  "videoProcessor": "/my/own/compiled/ffmpeg",
  "cameras": [
    ...
  ]
}
```

* `stillProcessor` is the video processor used to manage snapshots. eg: ffmpeg (by default) or avconv or /a/path/to/another/ffmpeg. Need to use the same parameters than ffmpeg.

#### Setting a source interface, or IP address

* `interfaceName` selects the IP address of a given network interface. The default is to select the first available, and that may not be the same IP address that ffmpeg will use. A mismatch will cause the iOS device to discard the video stream.

```
{
  "platform": "Camera-ffmpeg",
  "interfaceName": "bond0",
  "cameras": [
    ...
  ]
}
```

## Tested configurations

We have started collecting tested configurations in the wiki, so please before raising an issue with your configuration, please check the [wiki](https://github.com/KhaosT/homebridge-camera-ffmpeg/wiki).  Also if you have a working configuration that you would like to share, please add it to the [wiki](https://github.com/KhaosT/homebridge-camera-ffmpeg/wiki).

https://github.com/KhaosT/homebridge-camera-ffmpeg/wiki

## Credit

Homebridge Camera FFmpeg was originally created by [Khaos Tian](https://twitter.com/khaost).
