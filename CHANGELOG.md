# Change Log

All notable changes to this project will be documented in this file.

## v3.0.3 (2020-09-02)

### Changes

- Updated dependencies.

### Note

- Homebridge 1.1.3 is now out. It is highly recommended to upgrade as it should completely resolve the issue that caused live video not to work while snapshots continued to update. Once you upgrade, `interfaceName` will no longer have any impact. At some point in the future this plugin will drop support for Homebridge 1.1.2 and lower and also remove the `interfaceName` option.

## v3.0.2 (2020-08-30)

### Changes

- Allow `=` in the URL for HTTP automation for systems that require it. Everything after the `=` will be ignored.

## v3.0.1 (2020-08-25)

### Bug Fixes

- Fixed an issue with inactive camera timeouts that could cause zombie FFmpeg processes.

## v3.0.0 (2020-08-24)

### Changes

- This plugin now includes __experimental__ two-way audio support. Be aware that this feature is likely to be tweaked in the future, and a configuration that works now may need to be altered in the future.
- Better detection of audio and video streams. There should be very few scenarios where `mapvideo` or `mapaudio` are needed anymore, as FFmpeg's stream auto-selection is now set up.
- Default `videoFilter` can be disabled by including `none` in your comma-delimited list of filters.
- Further reorganization of the config UI.

### Bug Fixes

- Corrected handling of inactive camera timeouts. You should no longer see timeout messages after cleanly closing a camera stream.
- Fixed `forceMax` not applying to resolution in some scenarios.

### Breaking Changes

- `additionalCommandline` has been replaced by `encoderOptions` to better reflect it's intended use.
- `preserveRatio` has been removed and is now active as long as the default `videoFilter` list is active.

## v2.5.0 (2020-08-23)

### Changes

- `forceMax` has been added. This will force the use of `maxWidth`, `maxHeight`, `maxFPS`, and `maxBitrate` when set.
- If `maxWidth`, `maxHeight`, or `maxFPS` are set to `0`, the width, height, or framerate of the source will now be used for the output.
- If `maxBitrate` is set to `0`, the bitrate of the encoder will not be limited. I strongly recommend against this, but it is a better option than setting it to `999999` or similar values, as I've seen in some configs.
- Reorganized config UI options.

### Bug Fixes

- Fix handling of IPv6 connections.

### Breaking Changes

- Horizontal and vertical flip have been removed. If you need these options, pass `hflip` and/or `vflip` in `videoFilter`.
- `forceMax` has resulted in the removal of `minBitrate`, as it is now redundant. To replicate the old behavior, set `maxBitrate` to the bitrate you want to use and set `forceMax` to true.
- `preserveRatio` is now a boolean to reduce confusion and support the better handling of that option.

## v2.4.7 (2020-08-17)

### Changes

- Changed the way external IP address is determined. This should result in video streams working by default in more setups.

## v2.4.6 (2020-08-16)

### Bug Fixes

- Fix MQTT/HTTP automation when unbridge is used.

## v2.4.5 (2020-08-15)

### Changes

- Return messages and error codes when using HTTP automation.

### Bug Fixes

- Fixed bug preventing MQTT/HTTP automation from working.

## v2.4.4 (2020-08-07)

### Changes

- Added support for unbridging specific cameras. This can aid with performance of the camera and Homebridge as a whole, but requires manually adding any unbridged cameras to HomeKit.

## v2.4.3 (2020-07-29)

### Changes

- Trigger switches are now turned on and off with HTTP or MQTT messages as well.
- Removed doorbell stateless switch because it had no functionality.

## v2.4.2 (2020-07-27)

### Bug Fixes

- Properly shut down sessions when devices go inactive.
- Fixed some debug messages.

## v2.4.1 (2020-07-24)

### Changes

- Added warning when multiple NICs detected.

### Bug Fixes

- Fix error using copy vcodec.

## v2.4.0 (2020-07-24)

### Changes

- Major rework of code to make future maintenance easier.
- Added setting to limit HTTP server to listening on localhost only.

## v2.3.2 (2020-07-19)

### Bug Fixes

- FFmpeg processes are now killed when the iOS device goes inactive and when stopping Homebridge.

## v2.3.1 (2020-07-16)

### Changes

- Tweaks to logging to reduce confusion and provide more information.
- Added authentication support to MQTT.
- Reduced the FFmpeg log level in debug mode.

### Bug Fixes

- The minimum bitrate option is now working again.
- Maximum bitrate and frame rate are no longer capped below what devices request when not set in the config.

## v2.3.0 (2020-07-14)

### Changes

- Added HTTP support for motion detection and doorbells.
- Separated MQTT doorbell and motion messages.

## v2.2.2 (2020-07-13)

### Changes

- Restored ability to specify which network interface to use.

### Bug Fixes

- Fixed handling of non-printing characters in config.

## v2.2.1 (2020-07-11)

### Bug Fixes

- Fixed bug preventing Homebridge from starting.

## v2.2.0 (2020-07-11)

### Changes

- Now properly allows for changing camera manufacturer, model, etc.
- Minor tweaks to configuration UI screen.
- Update dependencies.

### Bug Fixes

- Fixed a bug when the doorbellSwitch config option was enabled.

## v2.1.1 (2020-07-08)

### Changes

- Update Dependencies.

## v2.1.0 (2020-07-06)

### Changes

- Add MQTT support for Motion Detect (#572), thanks to [fennec622](https://github.com/fennec622).
  - See [MQTT Motion Wiki](https://github.com/homebridge-plugins/homebridge-camera-ffmpeg/wiki/MQTT-Motion) for more details.
- Add stateless button for doorbell cameras.
- Add option to disable manual automation switches.
- Re-Added videoFilter.

### Bug Fixes

- Fixed most FFmpeg issues where users were receiving issues with ffmpeg exit 1 error.
- Fixed Logging.
- Fixed most videoFilter configs not working.

## v2.0.1 (2020-06-28)

### Changes

- Update Dependencies.

## v2.0.0 (2020-06-19)

### Breaking Changes

- Code has been refactored to typescript, thanks to [Brandawg93](https://github.com/Brandawg93).
- Plugin requires homebridge >= 1.0.0.
- Cameras no longer need to be manually added to homebridge
  - Cameras are now bridged instead of being created as external accessories in homebridge.
  - Once you update, you will see two copies of each of your cameras.
  - You will need to manually remove the old cameras from HomeKit by going into the cameras' settings and choosing "Remove Camera from Home".
  - The new bridged cameras will not have this option, and will instead have a "Bridge" button. \* You will also need to copy over any automations that you had tied to your cameras, such as motion detection.

#### Other Changes

- Google Drive Upload has been removed in this update. PRs are welcome for other Video Cloud Options.

## v1.3.0 (2020-06-18)

### Changes

- Update ffmpeg-for-homebridge to 0.0.6.

## v1.2.2 (2020-05-28)

### Changes

- Fix for Fake Motion Sensor, it was not reseting after Motion Events.

## v1.2.1 (2020-05-28)

### Changes

- Fixes [#522](https://github.com/homebridge-plugins/homebridge-camera-ffmpeg/issues/522), Cleans Up and Condenses the code around the motion switch.

## v1.2.0 (2020-05-27)

### Changes

- Update ffmpeg-for-homebridge to 0.0.5.

## v1.1.1 (2020-05-14)

### Changes

- Adds debug log for `videoProcessor`.

## v1.1.0 (2020-05-13)

### Features

- Adds an option to have a camera behave like a video doorbell, including a switch to trigger doorbell events (automate the switch to get notifications)
- Add Manufacturer, Model, Serial, and Firmware Revision into config.schema.json.

## v1.0.0 (2020-05-11)

### Breaking Changes

homebridge-camera-ffmpeg now comes bundled with it's own pre-built static ffmpeg binaries that are compiled with support for audio (libfdk-aac) and hardware decoding (h264_omx). The following platforms are supported:

- Raspbian Linux - armv6l (armv7l)
- Debian/Ubuntu Linux - x86_64, armv7l, aarch64
- Alpine Linux - x86_64, armv6l, aarch64
- macOS (10.14+) - x86_64
- Windows 10 - x86_64

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
