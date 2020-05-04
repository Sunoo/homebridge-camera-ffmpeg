#!/bin/bash

INSTANCE=$1
URL=$2
#pkill ffmpeg
mkdir /var/tmp/${INSTANCE}
cd /var/tmp/${INSTANCE}
rm /var/tmp/${INSTANCE}/*.mp4
#ffmpeg -max_delay 1000000 -rtsp_transport tcp -i ${URL} -map 0:0 -vcodec copy -f segment -segment_time 1 -segment_wrap 65 %02d.mp4
~/npm/lib/node_modules/ffmpeg-for-homebridge/ffmpeg -hide_banner -loglevel error -max_delay 1000000 -i ${URL} \
-map 0:0 -vcodec copy -map 0:1 -acodec libfdk_aac -f segment -segment_time 1 -segment_wrap 65 %02d.mp4
