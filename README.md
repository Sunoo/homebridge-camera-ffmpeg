# Homebridge Camera FFmpeg

[![npm](https://badgen.net/npm/v/homebridge-camera-ffmpeg) ![npm](https://badgen.net/npm/dt/homebridge-camera-ffmpeg)](https://www.npmjs.com/package/homebridge-camera-ffmpeg) [![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

[Homebridge](https://homebridge.io) Plugin Providing [FFmpeg](https://www.ffmpeg.org)-based Camera Support

## Installation

Before installing this plugin, you should install Homebridge using the [official instructions](https://github.com/homebridge/homebridge/wiki).

### Install via Homebridge Config UI X

1. Search for `Camera FFmpeg` on the Plugins tab of [Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x).
2. Install the `Homebridge Camera FFmpeg` plugin and use the form to enter your camera configurations.

### Manual Installation

1. Install this plugin using: `sudo npm install -g homebridge-camera-ffmpeg --unsafe-perm`.
2. Edit `config.json` manually to add your cameras. See below for instructions on that.

## Tested configurations

Other users have been sharing configurations that work for them in [our wiki](https://github.com/Sunoo/homebridge-camera-ffmpeg/wiki/Tested-Configurations). You may want to check that to see if anyone else has gotten your model of camera working already, or to share a configuration setup that works for you.

## Manual Configuration

### Most Important Parameters

- `platform`: _(Required)_ Must always be set to `Config-ffmpeg`.
- `name`: _(Required)_ Set the camera name for display in the Home app.
- `source`: _(Required)_ FFmpeg options on where to find and how to decode your camera's video stream. The most basic form is `-i` followed by your URL.
- `stillImageSource`: If your camera also provides a URL for a still image, that can be defined here with the same syntax as `source`. If not set, the plugin will grab one frame from `source`.

#### Config Example

```json
{
  "platform": "Camera-ffmpeg",
  "cameras": [
    {
      "name": "Camera Name",
      "videoConfig": {
        "source": "-i rtsp://myfancy_rtsp_stream",
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

### Optional Parameters

- `motion`: Exposes the motion sensor for this camera. This can be triggered with the dummy switches, MQTT messages, or via HTTP, depending on what features are enabled in the config. (Default: `false`)
- `doorbell`: Exposes the doorbell device for this camera. This can be triggered with the dummy switches, MQTT messages, or via HTTP, depending on what features are enabled in the config. (Default: `false`)
- `doorbellSwitch`: Exposes the statelss switch representing the doorbell button for this camera. (Default: `false`)
- `switches`: Enables dummy switches to trigger motion and/or doorbell, if either of those are enabled. When enabled there will be an additional switch that triggers the motion or doorbell event. See wiki for [more detailed instructions](https://github.com/Sunoo/homebridge-camera-ffmpeg/wiki/iOS-13-and-Photo-Notifications). (Default: `false`)
- `motionTimeout`: The number of seconds after triggering to reset the motion sensor. Set to 0 to disable resetting of motion trigger for MQTT or HTTP. (Default: `1`)
- `manufacturer`: Set the manufacturer name for display in the Home app.
- `model`: Set the model for display in the Home app.
- `serialNumber`: Set the serial number for display in the Home app.
- `firmwareRevision`: Set the firmware revision for display in the Home app.

#### Config Example with Manufacturer and Model Set

```json
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
        "source": "-i rtsp://myfancy_rtsp_stream",
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

### Optional videoConfig Parameters

- `maxStreams`: The maximum number of streams that will be allowed concurrently this camera. (Default: `2`)
- `maxWidth`: The maximum width used for video streamed to HomeKit. If not set, will use any size HomeKit requests.
- `maxHeight`: The maximum height used for video streamed to HomeKit. If not set, will use any size HomeKit requests.
- `maxFPS`: The maximum frame rate used for video streamed to HomeKit. If not set, will use any frame rate HomeKit requests.
- `minBitrate`: The minimum bitrate used for video streamed to HomeKit, in kbit/s. If set, it will override the bitrate requested by HomeKit if that is lower than this value.
- `maxBitrate`: The maximum bitrate used for video streamed to HomeKit, in kbit/s. If not set, will use any bitrate HomeKit requests.
- `preserveRatio`: Can be set to preserve the aspect ratio based on either `W`idth or `H`eight. If not set, aspect ratio is not preserved.
- `vcodec`: Set the codec used for encoding video sent to HomeKit, must be h.264-based. If you're running on a Raspberry Pi, you can change to the hardware accelerated video codec with this option. (Default: `libx264`)
- `audio`: Enables audio streaming from camera. (Default: `false`)
- `packetSize`: If audio or video is choppy try a smaller value, should be set to a multiple of 188. (Default: `1316`)
- `vflip`: Flips the stream vertically. (Default: `false`)
- `hflip`: Flips the stream horizontally. (Default: `false`)
- `mapvideo`: Selects the stream used for video. (Default: `0:0`)
- `mapaudio`: Selects the stream used for audio. (Default: `0:1`)
- `videoFilter`: Allows a custom video filter to be passed to FFmpeg via `-vf`.
- `additionalCommandline` Additional extra command line options passed to FFmpeg. (Default: `-preset ultrafast -tune zerolatency`)
- `debug`: Includes debugging output from FFmpeg in the Homebridge log. (Default: `false`)

#### More Complicated Example

```json
{
  "platform": "Camera-ffmpeg",
  "cameras": [
    {
      "name": "Camera Name",
      "videoConfig": {
        "source": "-i rtsp://myfancy_rtsp_stream",
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

### Automation Parameters

- `mqtt`: Defines the hostname or IP of the MQTT broker to connect to for MQTT-based automation. If not set, MQTT support is not started. See the wiki for [more information on using MQTT](https://github.com/Sunoo/homebridge-camera-ffmpeg/wiki/MQTT-Motion).
- `portmqtt`: The port of the MQTT broker. (Default: `1883`)
- `usermqtt`: The username used to connect to your MQTT broker. If not set, no authentication is used.
- `passmqtt`: The password used to connect to your MQTT broker. If not set, no authentication is used.
- `topic`: The base MQTT topic to subscribe to. (Default: `homebridge`)
- `httpport`: The port to listen on for HTTP-based automation. If not set, HTTP support is not started. See the wiki for [more information on using HTTP](https://github.com/Sunoo/homebridge-camera-ffmpeg/wiki/HTTP-Motion).

#### Automation Example

```json
{
  "platform": "Camera-ffmpeg",
  "mqtt": "127.0.0.1",
  "topic": "homebridge",
  "porthttp": "8080",
  "cameras": []
}
```

### Rarely Needed Parameters

- `videoProcessor`: Defines which video processor is used to decode and encode videos, must take the same parameters as FFmpeg. Common uses would be `avconv` or the path to a custom-compiled version of FFmpeg. If not set, will use the included version of FFmpeg, or the version of FFmpeg installed on the system if no included version is available.
- `interfaceName`: Selects which network interface to use for video streaming to HomeKit. If you have multiple active network interfaces in your system, you may need to set this. If not set, the first available network interface is used, and a mismatch will cause HomeKit to discard the video stream.

#### Rare Option Example

```json
{
  "platform": "Camera-ffmpeg",
  "videoProcessor": "/usr/bin/ffmpeg",
  "interfaceName": "eth0",
  "cameras": []
}
```

## Credit

Homebridge Camera FFmpeg is based on code originally written by [Khaos Tian](https://twitter.com/khaost).
