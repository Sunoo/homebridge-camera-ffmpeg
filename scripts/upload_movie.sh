#!/bin/bash

DIRECTORY=$1
FILENAME=$2

( cd
source ~/.node-red/passwords.sh
echo DEBUG=*,-log4j,-puppeteer:* ~/npm/bin/upload-gphotos ${FILENAME} -u USERNAME -p PASSWORD -a "${DIRECTORY}"
DEBUG=*,-log4js:*,-puppeteer:* ~/npm/bin/upload-gphotos ${FILENAME} -u $USERNAME -p $PASSWORD -a "${DIRECTORY}"
rm ${FILENAME}
)
