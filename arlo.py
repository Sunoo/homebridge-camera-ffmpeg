#! /usr/bin/python

import os
from Arlo import Arlo
import sys
import shelve
from datetime import timedelta, date
import datetime
import sys
import tempfile
import urlparse
import time
import pprint

USERNAME = sys.argv[1]
PASSWORD = sys.argv[2]
COMMAND = sys.argv[3]
CAMERAINDEX = int(sys.argv[4])
SHELFFILE = os.path.join(tempfile.gettempdir(), "arloSavedShelf.db")

arlo = None
basestations = None
cameras = None



def getArlo():

    global arlo

    try:
    	# Instantiating the Arlo object automatically calls Login(), which returns an oAuth token that gets cached.
    	# Subsequent successful calls to login will update the oAuth token.
        if not arlo:
    	       arlo = Arlo(USERNAME, PASSWORD)

    except Exception as e:
        print(e)

    return arlo



def isArloImageUrlExpired(url):

    parsedurlQueryParams = urlparse.urlparse(url).query.split("&")
    #print parsedurlQueryParams

    for queryParam in parsedurlQueryParams:
        param = queryParam.split("=")
        if param[0] == "Expires":
            #print "expires : " + param[1]
            if (time.time() >= (long(param[1]) - 3600)):
                return True
            else:
                return False
            break

    return True


def getCamerasAndBaseStations(force=False):

    global cameras
    global basestations

    try:
        # Get the list of devices and filter on device type to only get the basestation.
    	# This will return an array which includes all of the devices' associated metadata.

        devices = getArlo().GetDevices()
        cameras = [ device for device in devices if device['deviceType'] == 'camera']
        basestations = [ device for device in devices if device['deviceType'] == 'basestation']
    except Exception as e:
        print(e)


def getCamera(cameraIndex):

    global cameras

    if not cameras or isArloImageUrlExpired(cameras[cameraIndex]['presignedLastImageUrl']):
        getCamerasAndBaseStations()

    return cameras[cameraIndex]


def getBaseStation(baseStationIndex):

    global basestations

    if not basestations:
        getCamerasAndBaseStations()

    return basestations[baseStationIndex]



def getSnapShotURL(cameraIndex, snapShotUrlType):

    if snapShotUrlType == "newSnapshot":

        # Tells the Arlo basestation to trigger a snapshot on the given camera.
        # This snapshot is not instantaneous, so this method waits for the response and returns the url
        # for the snapshot, which is stored on the Amazon AWS servers.

        snapshot_url = getArlo().TriggerFullFrameSnapshot(getBaseStation(0), getCamera(cameraIndex))

    else:
        #snapShotUrlType can be one of presignedLastImageUrl, presignedSnapshotUrl, presignedFullFrameSnapshotUrl

        snapshot_url = getCamera(cameraIndex)[snapShotUrlType]


    return snapshot_url


def getStreamingURL(cameraIndex):

    # Open the event stream to act as a keep-alive for our stream.
    #arlo.Subscribe(basestations[0])

    # Send the command to start the stream and return the stream url.
    url = getArlo().StartStream(getBaseStation(0), getCamera(cameraIndex))

    return url


def dumpCameras(cameraIndex):

    i = 0
    while i <= cameraIndex:
        pprint.pprint(getCamera(i))
        i = i + 1



def restoreState():

    global SHELFFILE
    global cameras
    global basestations

    try:
        if os.path.exists(SHELFFILE):
            d = shelve.open(SHELFFILE)
            cameras = d['cameras']
            basestations = d['basestations']
            d.close()
            return True

    except Exception as e:
        print(e)

    return False


def saveState():

    global SHELFFILE
    global cameras
    global basestations

    try:
        d = shelve.open(SHELFFILE)
        d['cameras'] = cameras
        d['basestations'] = basestations
        d.close()

    except Exception as e:
        print(e)



def main():

    restoreState()

    if COMMAND == "dumpCameras":
        dumpCameras(CAMERAINDEX)
    elif COMMAND == "getStreamingURL":
        print getStreamingURL(CAMERAINDEX)
    else:
        print getSnapShotURL(CAMERAINDEX, COMMAND)

    saveState()


if __name__ == "__main__":
    main()
