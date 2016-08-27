/* jshint node:true, strict:false */
/* globals require, exports,   */

"use strict";

var config = require('../config.json');
var twilio 	= require('twilio');
var client 	= twilio(config.twilio.account_sid, config.twilio.auth_token);

if(process.argv.length<3) {
	console.log('USAGE: node delete_recordings.js <SID>\nwhere <SID> is the recording id or "ALL".');
	process.exit();
}

var sid = process.argv[2];

if (sid == 'ALL') {
	process.stdin.pause();
	console.log('Removing all recordings');
	client.recordings.list(function(err, data) {
		if(err) {
			console.log(err);
			process.exit();
		}
		console.log('Deleting :');
		data.recordings.forEach(function(recording) {
			delete_recording(recording.sid);
		});
	});
} else {
	console.log('Deleting: ' + sid);
	delete_recording(sid);
}

function delete_recording(sid) {
	client.recordings(sid).delete(function(err,res) {
		if (err) {
			console.log(err.status);
		} else {
			console.log("Sid "+ sid +" deleted successfully.");
		}
	});
}