#!/bin/bash

ALBUM=$1
FILENAME=$2

( cd
source ~/.node-red/passwords.sh
echo DEBUG=*,-log4j,-puppeteer* ~/npm/bin/upload-gphotos ${FILENAME} --no-output-json -u USERNAME -p PASSWORD -a "${ALBUM}"
DEBUG=*,-log4js:*,-puppeteer* ~/npm/bin/upload-gphotos ${FILENAME} --no-output-json -u $USERNAME -p $PASSWORD -a "${ALBUM}"
rm ${FILENAME}
)
