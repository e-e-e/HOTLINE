/* jshint esnext:true, globalstrict:true */
/* globals require, exports:true, module, console */

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
router.get('/hotline/record_or_listen', (req, res) => {
	if (req.query.Digits == '1') 
		res.redirect('/hotline/record');
	else
		res.redirect('/hotline/listen');
});

//record a message
router.get('/hotline/record', (req, res) => {
	var resp = new twilio.TwimlResponse();
	resp.say("Leave a message, press the hash key to end.", say_settings);
	resp.record({ 
		action: "/hotline/finished_recording",
		finishOnKey:'#',
		maxLength:120,
		playBeep:true,
		transcribeCallback: "/hotline/transcribed",
		method:'GET'
	});
	//NO RECORDING
	resp.say('No recording recieved', say_settings);
	resp.redirect('/hotline/listen');
	send_response(res,resp);
});

router.post('/hotline/transcribed', (req,res) => {
	var resp = new twilio.TwimlResponse();
	console.log(req.params);
	if(req.params.transcriptionStatus === 'completed') {
		//we are good to send to twitter
		console.log(req.params.TranscriptionText);
	} else {
		send_response(res,resp);
	}
});

// listen to the recordings
router.get('/hotline/listen', (req, res) => {
	//get all recordings - then reorder and play them all.
	let resp = new twilio.TwimlResponse();
	client.recordings.list()
		.then(data => shuffle(data.recordings))
		.then(recordings => {
			if(recordings.length === 0) {
				resp.say('no messages, be the first to leave a message',say_settings);
				resp.redirect('/hotline/', {method:"GET"});
			} else {
				recordings.forEach( recording => resp.play(recording_uri(recording)) );
				resp.redirect('/hotline/listen', {method:"GET"});
			}
		})
		.then( send_response_fn(res,resp) );
});

//recording is done
router.get('/hotline/finished_recording', (req, res) => {
	//playback message
	req.session.recording = req.query.RecordingSid;
	let resp = new twilio.TwimlResponse();
	resp.gather({
		action: '/hotline/save/'+req.query.RecordingSid,
		method:'GET',
		numDigits:1,
		timeout:1
	}, node => {
		node.say('press 1 to save',say_settings);
		node.say('or any other key to rerecord',say_settings);
		node.play(req.query.RecordingUrl);
		console.log('\n\nRECORDERING URL = '+ req.query.RecordingUrl + '\n\n');
	});
	//if hung up call goes through this again.
	resp.redirect('/hotline/finished_recording?RecordingSid='+req.query.RecordingSid +
								'&RecordingUrl='+req.query.RecordingUrl, { method : "GET" });
	send_response(res,resp);
});

router.get('/hotline/save/:RecordingSid', (req, res) => {
	if (req.query.Digits=='1') {
		//save
		//do not delete message on hang up
		req.session.recording = null;
		let resp = new twilio.TwimlResponse();
		resp.say('message saved.', say_settings);
		resp.say('stay on the line to keep listening', say_settings);
		resp.redirect('/hotline/listen', {method: 'GET'});
		send_response(res,resp);
	} else {
		//delete message
		//rerecord
		req.session.recording = null;
		client.recordings(req.params.RecordingSid)
			.delete()
			.then(data => {
				console.log("\n\nSid "+req.params.RecordingSid+" deleted successfully.\n\n");
				res.redirect('/hotline/record');
			});
	} 
});

router.get('/hotline/delete/:RecordingSid', (req, res) => {
	//req.session.recording = null;
	//console.log("\n\nDELETING RECORDING "+ req.params.RecordingSid + '\n\n');
	let resp = new twilio.TwimlResponse();
	client.recordings(req.params.RecordingSid)
		.delete()
		.then(data => resp.say('message deleted. goodbye.', say_settings) )
		.finally( send_response_fn(res,resp) );
});


router.use('/hotline/hangup', (req, res) => {
	if(req.session.recording) {
		res.redirect('/hotline/delete/'+req.session.recording);
	} else {
		var resp = new twilio.TwimlResponse();
		resp.say('all is good. goodbye',say_settings);
		send_response(res,resp);
	}
});

router.use('/hotline/', (req, res) => {
	var resp = new twilio.TwimlResponse();
	resp.say("Welcome to the hotline.", say_settings);
	// play a message first
	client.recordings.list()
		.then( data => choose_random(data.recordings))
		.then( recording => {
			if(recording)	resp.play(recording_uri(recording));
			//"https://api.twilio.com/2010-04-01/Accounts/" + recording.accountSid + "/Recordings/" + recording.sid);
		})
		.catch( err => console.log(err))
		.then( () => {
			resp.gather({
				action: '/hotline/record_or_listen',
				method: 'GET',
				numDigits:1
			}, node => 
				node.say('Press 1 to leave a message', say_settings)
						.say('or any other key to keep listening.', say_settings)
			);
			resp.redirect('/hotline/listen',{ method:'GET' });
		})
		.finally( send_response_fn(res,resp) );
});

function send_response(res,resp) {
	res.writeHead(200, {'Content-Type': 'text/xml'});
	res.end(resp.toString());
}

function send_response_fn(res,resp) {
	return () => {
		res.writeHead(200, {'Content-Type': 'text/xml'});
		res.end(resp.toString());
	};
}

function recording_uri (recording) {
	return "https://api.twilio.com/2010-04-01/Accounts/" + recording.accountSid + "/Recordings/" + recording.sid;
}

function choose_random (array) {
	if(Array.isArray(array) && array.length > 0 ) {
		return array[ Math.floor( Math.random() * array.length ) ];
	} else {
		return null;
	}
}

function shuffle (array) {
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

