# homebridge-camera-ffmpeg-ufv

[UniFi Video](https://www.ubnt.com/unifi-video/unifi-nvr/) plugin for [Homebridge](https://github.com/nfarina/homebridge), based on [homebridge-camera-ffmpeg](https://github.com/KhaosT/homebridge-camera-ffmpeg)

This plugin connects your UniFi Video cameras to HomeKit via your UniFi Video NVR.

It automatically finds the RTSP-enabled cameras on the NVR. It then uses ffmpeg to convert the video streams from the NVR into the format HomeKit requires.

The NVR API is undocumented and unsupported. It is subject to change at any time. Use at your own risk.

## Requirements

- The UniFi Video NVR is required. This plugin was developed and tested against UFV NVR version 3.7.1.
- Cameras must have at least one "RTSP Service" enabled. The plugin uses the highest-quality stream enabled for the camera.
- At least one user must have an API key, and "API Usage" must be turned on.
- The API port and the RTSP port must be open on the NVR system's firewall, if applicable. The API port is probably 7080 (http) or 7443 (https), and your RTSP port is probably 7447. You can confirm these in your UniFi NVR configuration.
- Homebridge is required. This guide assumes you have homebridge working.
- The system running homebridge must have ffmpeg and the node ffmpeg module installed.

## Install

1. Install ffmpeg on your homebridge system, if necessary, as via your system's package manager.
2. Install the ffmpeg npm module on your homebridge system, if necessary: `sudo npm install -g ffmpeg`
3. Install this plugin: `sudo npm install -g homebridge-camera-ffmpeg-ufv`

## Configure UniFi Video

1. Log in to your NVR's web GUI.
2. Under Cameras > (camera) > Video > RTSP service, turn on RTSP for each camera you want to make available to HomeKit. This plugin will use the highest quality stream that you enable. Note that whatever you choose will be converted to at least 720p at 15 fps, as required by HomeKit.
3. Under Users > (user) > API Access, turn on "Allow API Usage" and make note of your API key.

## Configure Homebridge

On your homebridge system, edit config.json to add a platform block like this:

```
{
  "platform": "camera-ffmpeg-ufv",
  "name": "UniFi Video (ffmpeg)",
  "nvrs": [
    {
      "apiHost": "nvr-ip-or-hostname.example.com",
      "apiPort": 7443,
      "apiProtocol": "https",
      "apiKey": "<api key from NVR user settings>"
    }
  ]
}
```
- apiHost is the IP address or hostname of your NVR.
- apiPort is the port your admin portal is listening on, usually 7080 or 7443.
- apiProtocol is either http or https.
- apiKey is the API key you noted earlier.

Start or restart homebridge to update the configuration.

## Add cameras to your HomeKit home

HomeKit ultimately requires you to add each camera individually. Use the code displayed on the console by homebridge when it starts up.

1. On your iOS device, in the Home app, tap the plus sign in the top right corner, then tap "Add Accessory…"
2. Tap on one of the discovered cameras.
3. Acknowledge the warning that this accessory is unsupported.
4. Tap "Enter code manually" and enter the code from the homebridge console.
5. Set your preferences for this camera, then tap "Done."

## Known issues

HTTPS is supported, but we ignore the error caused by NVR's built-in self-signed certificate. This is insecure, and we should handle it better once the NVR supports real certificates.

Raspberry Pi users require a different build of ffmpeg with omx enabled for best results.

This plugin recognizes only the first server configured for an NVR. The UniFi Video API can describe multiple servers per NVR, but it does not seem to identify the server that corresponds to a given camera. The UniFi Video NVR software does not officially support multiple servers. If you're using the unsupported configuration for this, let's talk.

Lag is a minor issue, both for the still snapshot and for the live stream. Right now, the snapshot is delayed by the time it takes for ffmpeg to connect to the stream and grab a frame. It's possible to grab a still frame directly. This is preferable, and this should be sorted out soon as well. The live stream is delayed by about 10 seconds while ffmpeg starts the stream client, starts transcoding, and sets up the encryption HomeKit requires. Can this be optimized? Probably.

Weirdly, when homebridge starts up, it will report the same name for each camera that it publishes.

It doesn't strictly use the highest-quality stream available; rather, it uses the first channel in the array returned by the API. So far, they appear to come back in descending order of quality, so the first one in the array should be the best stream.

Cameras are discovered only when Homebridge starts up. If you add or remove cameras, you will need to restart Homebridge.

## Debugging

This plugin uses the debug module. To see debugging output, run homebridge with a DEBUG env var set:
```
$ DEBUG=* homebridge # Show debugging output for all modules
$ DEBUG=camera-ffmpeg-ufv homebridge # Show debugging output for this module only
```

## Notes

I'm calling it camera-ffmpeg-ufv. 'ffmpeg' is in the name because, while there may be many approaches to this, this one uses ffmpeg. 'ufv' is in the name because 'homebridge-camera-ffmpeg-unifi-video' starts getting lengthy, and besides, I don't want to use 'unifi' in the name and have anyone thinking UBNT is officially providing this plugin. This is not a Ubiquiti product.
