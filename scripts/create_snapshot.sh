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
# rm *.jpeg
ls -tr ${INSTANCE}/* | tail -2 | head -1 |awk '{ print "file "$1 }' > snapshot_${INSTANCE}_$$.txt

ffmpeg -f concat -i snapshot_${INSTANCE}_$$.txt -frames:v 1 ${OPTIONS} -f image2 -
# ffmpeg -f concat -i snapshot_${INSTANCE}.txt -frames:v 1  ${OPTIONS} -f image2 -y ${GFILENAME}
rm snapshot_${INSTANCE}_$$.txt
)
