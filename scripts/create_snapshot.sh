#!/bin/bash

INSTANCE=$1

OS=`uname -s`
if [[ "$OS" == 'Darwin' ]]; then
  OPTIONS=
elif [[ "$OS" == 'Linux' ]]; then
  #OPTIONS="-c:v h264_omx -profile:v high -b:v 3000000"
  #OPTIONS="-c:v h264_omx -b:v 3000000"
  OPTIONS=
fi


( cd /var/tmp
FILE=`ls -tr ${INSTANCE}/* | tail -3 | head -1`

if [ -z "$FILE" ]
then
	pkill ffmpeg
else
	~/npm/lib/node_modules/ffmpeg-for-homebridge/ffmpeg -hide_banner -loglevel error -i $FILE -frames:v 1 ${OPTIONS} -f image2 -
fi
)
