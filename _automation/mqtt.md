---
title: MQTT-based Automation
order: 2
---
### Setup

Set `mqtt` in your config to be the host or IP of your MQTT broker. The MQTT client will not start without this set. You can also set `portmqtt` if your broker listens on a port other than the default 1883, or `topic` if you want to change the base topic to something besides the default of `homebridge`.

### Usage

To trigger the motion sensor publish to topic `homebridge/motion` with the camera name as the message.

If you publish a message with the camera name to `homebridge/motion/reset` it will reset the motion sensor. If you plan to use this function, it is recommended to set `motionTimeout` under the camera to `0` to disable the automatic reset of the motion sensor.

Doorbell activation is also available by publishing to topic `homebridge/doorbell` with the camera name as the message.

### Config Example

```json
{
  "platform": "Camera-ffmpeg",
  "mqtt": "127.0.0.1",
  "topic": "homebridge",
  "cameras": [
    {
      "name": "Camera name",
      "motion": true,
      "motionTimeout": 1,
      "videoConfig": {
        "source": "-i http://10.0.0.1",
        "stillImageSource": "-i http://10.0.0.1",
        "maxStreams": 5,
        "maxWidth": 1280,
        "maxHeight": 720,
        "maxFPS": 15,
        "maxBitrate": 1000
      }
    }
  ]
}
```
