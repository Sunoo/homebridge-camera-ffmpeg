'use strict';

const GPhotos = require('upload-gphotos').default;
var Queue = require('better-queue');
var streamifier = require('./lib/streamifier.js');
let debug = require('debug')('ffmpeg:gphoto');

module.exports = {
  gphoto: gphoto
};

var uploadQueue = new Queue(function(upload, callback) {
  googleUpload.call(upload.that, upload, callback);
}, {
  autoResume: true,
  maxRetries: 0,
  retryDelay: 30000,
  batchDelay: 500,
  afterProcessDelay: 500
});

var gphotos;

function gphoto(cameraConfig) {
  (async () => {
    if (!gphotos) {
      gphotos = new GPhotos({
        username: cameraConfig.username,
        password: cameraConfig.password,
        options: {
          silence: false,
          progress: true
        }
      });
      await gphotos.login();
      debug("Logged in");
    }
  })();
}

function googleUpload(upload, callback) {
  (async () => {
    debug("Dequeue", upload.imageBuffer.length, upload.fileName);
    (async () => {
      // streamifier.createReadStream(new Buffer ([97, 98, 99])).pipe(process.stdout);
      try {
        if (!gphotos.params) {
          await gphotos.login();
          debug("Logged in to Google");
        }
        const photo = await gphotos.uploadFromStream(streamifier.createReadStream(upload.imageBuffer), upload.imageBuffer.length, upload.fileName);
        // this.log("addPhoto", photo.createdAt);
        const album = await gphotos.searchOrCreateAlbum((this.cameraConfig.album ? this.cameraConfig.album : 'Camera Pictures'));
        // this.log("searchOrCreateAlbum", photo.createdAt);
        const id = await album.addPhoto(photo);
        this.log("Uploaded", upload.fileName);
      } catch (err) {
        this.log("Error:", err);
        gphotos.params = null;
      }
      callback();
    })();
  })();
}

gphoto.prototype.upload = function(upload) {
  uploadQueue.push(upload);
};
