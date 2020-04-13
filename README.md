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

- Basic Installation
  - Install this plugin using: `npm install -g homebridge-camera-ffmpeg`
  - Edit `config.json` and add the camera.
  - Run Homebridge
  - Add extra camera accessories in Home app. The setup code is the same as homebridge.

- Install via Homebridge Web UI 
  - Search for `Camera FFmpeg` on the plugin screen of [config-ui-x](https://github.com/oznu/homebridge-config-ui-x) .
  - Click install.

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

* `uploader` enable uploading of snapshots to Google Drive, defaults to `false`. See wiki for more detailed instructions.
* `motion` enable a dummy switch and motion sensor to trigger picture notifications in iOS 13, defaults to `false`.  See wiki for more detailed instructions.
* `manufacturer` set manufacturer name for display in the Home app
* `model` set model for display in the Home app
* `serialNumber` set serial number for display in the Home app
* `firmwareRevision` set firmware revision for display in the Home app

Example with manufacturer, model, serial number and firmware set:

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

#### Optional videoConfig Parameters

* `maxStreams` is the maximum number of streams that will be generated for this camera, default 2
* `maxWidth` is the maximum width reported to HomeKit, default `1280`
* `maxHeight` is the maximum height reported to HomeKit, default `720`
* `maxFPS` is the maximum frame rate of the stream, default `10`
* `minBitrate` is the minimum bit rate of the stream in kbit/s, default `0`
* `maxBitrate` is the maximum bit rate of the stream in kbit/s, default `300`
* `preserveRatio` can be set to either `W` or `H` with respective obvious meanings, all other values have no effect
* `vcodec` If you're running on a RPi with the omx version of ffmpeg installed, you can change to the hardware accelerated video codec with this option, default `libx264`
* `audio` can be set to true to enable audio streaming from camera. To use audio ffmpeg must be compiled with --enable-libfdk-aac, see https://github.com/KhaosT/homebridge-camera-ffmpeg/wiki, default `false`. Many ffmpeg binaries are not compiled with libfdk-aac, and to work around this issue, force the OPUS codec:
  `"acodec": "libopus"`
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
