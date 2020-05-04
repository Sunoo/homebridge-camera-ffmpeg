# Change Log

All notable changes to this project will be documented in this file. This project uses [Semantic Versioning](https://semver.org/).


## v0.1.20 (2020-05-05)

### Breaking Changes

* We are now bundling static ffmpeg binaries for Homebridge with support for audio (libfdk-aac) and hardware decoding (h264_omx) for most major platforms.  Details are [here](https://github.com/homebridge/ffmpeg-for-homebridge)
  * And are defaulting to use the supplied version unless a different version is specified with the `videoProcessor` configuration option.

### Notable Changes
