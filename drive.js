var debug = require('debug')('CameraDrive');
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var url = require('url');

module.exports = {
    drive: drive
}

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/drive-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/drive'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.homebridge/';
var TOKEN_PATH = TOKEN_DIR + 'drive-nodejs-quickstart.json';
var SECRET_PATH = TOKEN_DIR + 'client_secret.json';
var auth;

function drive() {

    // Load client secrets from a local file.
    fs.readFile(SECRET_PATH, function processClientSecrets(err, content) {
        if (err) {
            console.log('Error loading client secret file, please follow the instructions in the README!!!' + err);
            return;
        }
        // Authorize a client with the loaded credentials, then call the
        // Drive API.
        authorize(JSON.parse(content), function(authenticated) {

            auth = authenticated;
            debug("Authenticated");

        });
    });


}

drive.prototype.storePicture = function(prefix, picture) {
    // get folder ID
    debug("getFolder");
    if (auth) {
        getPictureFolder(function(err, folder) {
            debug("upload");
            uploadPicture(folder, prefix, picture);
        })
    }
}

function getPictureFolder(cb) {
    var folder;
    var drive = google.drive('v3');

    drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and name = 'Camera Pictures'",
        fields: 'nextPageToken, files(id, name)',
        spaces: 'drive',
        auth: auth
    }, function(err, res) {
        if (err) {
            cb(err);
        } else {
            if (res.files.length > 0) {
                res.files.forEach(function(file) {
                    debug('Found Folder: ', file.name, file.id);
                    cb(null, file.id);
                });
            } else {
                var fileMetadata = {
                    'name': 'Camera Pictures',
                    'mimeType': 'application/vnd.google-apps.folder'
                };
                drive.files.create({
                    resource: fileMetadata,
                    fields: 'id',
                    auth: auth
                }, function(err, file) {
                    if (err) {
                        // Handle error
                        console.log(err);
                    } else {
                        debug("Created Folder", file.id);
                        cb(null, file.id);
                    }
                })
            }
        }
    })
}

function uploadPicture(folder, prefix, picture) {
    var drive = google.drive('v3');
    var d = new Date();
    var parsedUrl = url.parse(prefix.substr(prefix.search('http')), true, true);
    var name = prefix.replace(/ /g, "_") + "_" + d.toLocaleString().replace(/ /g, "_").replace(/,/g, "") + ".jpeg";

    debug("upload picture", folder, name);

    var fileMetadata = {
        'name': name,
        parents: [folder]
    };
    var media = {
        mimeType: 'image/jpeg',
        body: picture
    };

    drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id',
        auth: auth
    }, function(err, file) {
        if (err) {
            // Handle error
            console.log(err);
        } else {
            debug('File Id: ', file.id);
        }
    });

}

// This is all from the Google Drive Quickstart

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function(err, token) {
        if (err) {
            getNewToken(oauth2Client, callback);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client);
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listFiles(auth) {
    var drive = google.drive('v3');
    drive.files.list({
        auth: auth,
        pageSize: 30,
        fields: "nextPageToken, files(id, name)"
    }, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var files = response.files;
        if (files.length == 0) {
            debug('No files found.');
        } else {
            debug('Files:');
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                debug('%s (%s)', JSON.stringify(file, null, 2), file.name, file.id);
            }
        }
    });
}

function uploadFile(auth) {
    var drive = google.drive('v3');

    var fetchPage = function(pageToken, pageFn, callback) {
        drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and name = 'Camera Pictures'",
            fields: 'nextPageToken, files(id, name)',
            spaces: 'drive',
            pageToken: pageToken,
            auth: auth
        }, function(err, res) {
            if (err) {
                callback(err);
            } else {
                res.files.forEach(function(file) {
                    debug('Found file: ', file.name, file.id);
                });
                if (res.nextPageToken) {
                    debug("Page token", res.nextPageToken);
                    pageFn(res.nextPageToken, pageFn, callback);
                } else {
                    callback();
                }
            }
        });
    };
    fetchPage(null, fetchPage, function(err) {
        if (err) {
            // Handle error
            console.log(err);
        } else {
            // All pages fetched
        }
    });





    var fileMetadata = {
        'name': 'Camera Pictures',
        'mimeType': 'application/vnd.google-apps.folder'
    };
    drive.files.create({
        resource: fileMetadata,
        fields: 'id',
        auth: auth
    }, function(err, file) {
        if (err) {
            // Handle error
            console.log(err);
        } else {
            debug('Folder Id: ', file.id);

            var fileMetadata = {
                'name': 'photo.jpg',
                parents: [file.id]
            };
            var media = {
                mimeType: 'image/jpeg',
                body: fs.createReadStream('photo.jpg')
            };

            drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id',
                auth: auth
            }, function(err, file) {
                if (err) {
                    // Handle error
                    console.log(err);
                } else {
                    debug('File Id: ', file.id);
                }
            });



        }
    });


}
