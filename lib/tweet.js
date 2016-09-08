/* jshint esnext:true, globalstrict:true */
/* globals require, exports:true, module, console */

"use strict";

const config			= require('../config.json');

const Q = require('q');

const Twitter = require('twitter');
const client = new Twitter(config.twitter);

exports = module.exports = {
	send_tweet: function (message) {
		console.log("sending: ", message);
		if(message.length<140) {
			return send(message);
		} else {
			//make array of words
			let words = message.split(' ');
			let count = 0;
			let msg_part = '';
			let promises = [];
			words.forEach( w => {
				if( msg_part.length + w.length + 1 >= 136 ) {
					//break
					msg_part += '...';
					promises.push(send(msg_part));
					msg_part = '...';
				} else {
					//add word to msg part
					msg_part += (message==='') ? w : ' ' + w ;
				}
			});
			if(msg_part!=='') {
				promises.push(send(msg_part));
			}
			//return sequalised promises
			return promises.reduce(Q.when, Q());
		}
	}
};

function send (message) {
	let deferred = Q.defer();
	client.post('statuses/update', {status: message}, (error, tweet, response) => {
			if (!error) {
				deferred.resolve({ tweet:tweet, response:response });
			} else deferred.reject(error);
		});
	return deferred.promise;
}