# Change Log

All notable changes to this project will be documented in this file. This project uses [Semantic Versioning](https://semver.org/).

## v1.2.1 (2020-05-28)

### Changes
* Fixes [#522](https://github.com/homebridge-plugins/homebridge-camera-ffmpeg/issues/522), Cleans Up and Condenses the code around the motion switch.

## v1.2.0 (2020-05-27)

### Changes
* Update ffmpeg-for-homebridge to 0.0.5.

## v1.1.1 (2020-05-14)

### Changes
* Adds debug log for `videoProcessor`.

## v1.1.0 (2020-05-13)

### Features
* Adds an option to have a camera behave like a video doorbell, including a switch to trigger doorbell events (automate the switch to get notifications)
* Add Manufacturer, Model, Serial, and Firmware Revision into config.schema.json.

## v1.0.0 (2020-05-11)

### Breaking Changes

homebridge-camera-ffmpeg now comes bundled with it's own pre-built static ffmpeg binaries that are compiled with support for audio (libfdk-aac) and hardware decoding (h264_omx). The following platforms are supported:

* Raspbian Linux - armv6l (armv7l)
* Debian/Ubuntu Linux	- x86_64, armv7l, aarch64
* Alpine Linux - x86_64, armv6l, aarch64
* macOS (10.14+) - x86_64
* Windows 10 - x86_64

If your platform is not supported the plugin will fallback to using your global install of `ffmpeg` automatically.

Should you wish to force the plugin to use the global install of `ffmpeg` instead of the provided copy, you can simply set `videoProcessor` option to `ffmpeg`. Example:

```json
{
  "platform": "Camera-ffmpeg",
  "videoProcessor": "ffmpeg",
  "cameras": [
    ...
  ]
}
```
