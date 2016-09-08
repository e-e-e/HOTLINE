/* jshint esnext:true, globalstrict:true */
/* global require, console, __dirname */

"use strict";

var config 		= require('./config.json');

var express = require('express');
var hotline = require('./routes/hotline.js');


// libraries need for serving content
var fs = require('fs');
var path = require('path');
var express = require('express');
var helmet = require('helmet');
var bodyparser = require('body-parser');

var app = express();

app.use(helmet());
app.use(helmet.noCache());

app.use( bodyparser.json() );
app.use( bodyparser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname,'/public')));
app.use(hotline.router);

app.use('*', (req,res) => res.status(404).send('404: not found') );
app.use((err,req,res) => res.status(500).send('Err 500:' + err) );

app.listen(config.server.port, (err, suc) => {
	if (err) {
		throw err;
	} else {
		console.log('listening on' + config.server.port);
	}
});