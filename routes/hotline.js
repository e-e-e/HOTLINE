/* jshint node:true, strict:false */
/* globals require, exports:true, module */
"use strict";

// for router

var config			= require('../config.json');

var express = require('express');
var twilio 	= require('twilio');

var client 	= twilio(config.twilio.account_sid, config.twilio.auth_token);

// for middleware
var cookieParser 	= require('cookie-parser');
var session 		= require('express-session');

var say_settings = { voice: 'alice', language:'en-AU'};

var router = express.Router();

//export router and middleware
exports = module.exports = {
	router: router
};

router.use(cookieParser());
router.use(session({
	secret: config.server.session_secret,
	saveUninitialized: true,
	resave: true })
);

//set up routers
router.get('/hotline/record_or_listen',function(req, res, next) {
	if (req.query.Digits == '1') 
		res.redirect('/hotline/record');
	else
		res.redirect('/hotline/listen');
});

//record a message
router.get('/hotline/record',function(req, res, next) {
	var resp = new twilio.TwimlResponse();
	
	resp.say("Leave a message, press the hash key to end.", say_settings);
	
	resp.record({ 
		action: "/hotline/finished_recording",
		finishOnKey:'#',
		maxLength:120,
		playBeep:true,
		method:'GET'
	});

	//NO RECORDING
	resp.say('No recording recieved', say_settings);
	resp.redirect('/hotline/listen');
	res.writeHead(200, {'Content-Type': 'text/xml'});
	res.end(resp.toString());
});

// listen to the recordings
router.get('/hotline/listen', function(req,res,next) {
	//get all recordings - then reorder and play them all.
	client.recordings.list(function(err, data) {
		if(err) {
			//do something
		}
		var resp = new twilio.TwimlResponse();
		var recordings = shuffle(data.recordings);
		if(recordings.length === 0) {
			resp.say('no messages, be the first to leave a message',say_settings);
			resp.redirect('/hotline/', {method:"GET"});
		} else {
			recordings.forEach(function(recording) {
				resp.play("https://api.twilio.com/2010-04-01/Accounts/" + recording.accountSid + "/Recordings/" + recording.sid);
				resp.redirect('/hotline/listen', {method:"GET"});
			});
		}
		res.writeHead(200, {'Content-Type': 'text/xml'});
		res.end(resp.toString());
	});
	
});

//recording is done
router.get('/hotline/finished_recording',function(req, res, next) {
	//playback message

	req.session.recording = req.query.RecordingSid;
	
	var resp = new twilio.TwimlResponse();	
	resp.gather({
		action: '/hotline/save/'+req.query.RecordingSid,
		method:'GET',
		numDigits:1,
		timeout:1
	}, function() {
		this.say('press 1 to save',say_settings);
		this.say('or any other key to rerecord',say_settings);
		this.play(req.query.RecordingUrl);
		console.log('\n\nRECORDERING URL = '+ req.query.RecordingUrl + '\n\n');
	});
	//if hung up call goes through this again.
	resp.redirect('/hotline/finished_recording?RecordingSid='+req.query.RecordingSid +
								'&RecordingUrl='+req.query.RecordingUrl, { method : "GET" });
	
	res.writeHead(200, {'Content-Type': 'text/xml'});
	res.end(resp.toString());
});

router.get('/hotline/save/:RecordingSid', function(req,res) {
	
	if (req.query.Digits=='1') {
		//save
		//do not delete message on hang up
		req.session.recording = null;
		var resp = new twilio.TwimlResponse();
		resp.say('message saved.',say_settings);
		resp.say('stay on the line to keep listening',say_settings);
		resp.redirect('/hotline/listen', {method: 'GET'});
		res.writeHead(200, {'Content-Type': 'text/xml'});
		res.end(resp.toString());
	} else {
		//delete message
		//rerecord
		req.session.recording = null;
		client.recordings(req.params.RecordingSid).delete(function(err, data) {
			if(err) {
				console.log(err);
				throw err;
			}
			console.log("\n\nSid "+req.params.RecordingSid+" deleted successfully.\n\n");
			res.redirect('/hotline/record');
		});
	} 
	
});

router.get('/hotline/delete/:RecordingSid',function(req,res) {
	//req.session.recording = null;
	console.log("\n\nDELETING RECORDING "+ req.params.RecordingSid + '\n\n');
	client.recordings(req.params.RecordingSid).delete(function(err, data) {
		if (err) {
			throw err.message;
		} else {
			var resp = new twilio.TwimlResponse();
			resp.say('message deleted. goodbye.',say_settings);
			res.writeHead(200, {'Content-Type': 'text/xml'});
			res.end(resp.toString());
		}
	});
});


router.use('/hotline/hangup', function(req, res, next) {
	if(req.session.recording) {
		res.redirect('/hotline/delete/'+req.session.recording);
	} else {
		var resp = new twilio.TwimlResponse();
		resp.say('all is good. goodbye',say_settings);
		res.writeHead(200, {'Content-Type': 'text/xml'});
		res.end(resp.toString());
	}
});

router.use('/hotline/',function(req, res, next) {
	var resp = new twilio.TwimlResponse();
	resp.gather({
        action: '/hotline/record_or_listen',
        method: 'GET',
        numDigits:1
    }, function() {
        this.say('Press 1 to leave a message', say_settings)
            .say('or any other key to keep listening.', say_settings);
    });
	resp.redirect('/hotline/listen',{ method:'GET' });
	res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(resp.toString());
});

function shuffle(array) {
	var cur_index = array.length, temp_val, rand_index ;
	// While there remain elements to shuffle...
	while (0 !== cur_index) {
		// Pick a remaining element...
		rand_index = Math.floor(Math.random() * cur_index);
		
		cur_index -= 1;

		// And swap it with the current element.
		temp_val = array[cur_index];
		array[cur_index] = array[rand_index];
		array[rand_index] = temp_val;
	}
	return array;
}

