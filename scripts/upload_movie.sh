#!/bin/bash

DIRECTORY=$1
FILENAME=$2

( cd
echo DEBUG=*,-log4j ~/npm/bin/upload-gphotos ${FILENAME} -q -c ~/.node-red/upload-gphoto.json -a "${DIRECTORY}"
DEBUG=*,-log4js:* ~/npm/bin/upload-gphotos ${FILENAME} -q -c ~/.node-red/upload-gphoto.json -a "${DIRECTORY}"
rm ${FILENAME}
)
