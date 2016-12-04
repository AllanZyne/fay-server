"use strict";

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const { async, access, readFile } = require('../lib/async.js');
const database = require('../lib/database.js');


function setVoiceFile(db, projectName, fileName, lineIndex, voiceFile) {
	return database.files_list(db, projectName, fileName).then((results) => {
	    let fileId = results[0]._id;
	    let lineId = (fileId << 12) | lineIndex;

	    let linesCol = db.collection('lines');
	    // console.log(linesCol);
	    return linesCol.updateOne({ _id: lineId }, {
	    	$set: {
	    		voice: voiceFile
	    	}
	    });
	});
}

(async(function*() {
	let db = yield database.connect().catch(err => { throw err; });
	let voiceBuffer = yield readFile("D:\\_GAME\\AiryFairy\\_py\\voice.json");
	// console.log(voiceBuffer);
	let voiceMap = JSON.parse(voiceBuffer.toString());
	// console.log(voiceMap);
	for (let fileName in voiceMap) {
		let _fileName = fileName.replace(/mjs$/, 'sjsx');
		console.log(_fileName);
		let voiceList = voiceMap[fileName];
		for (let voicePair of voiceList) {
			let [voiceFile, lineIndex] = voicePair;
			lineIndex = parseInt(lineIndex, 10) - 1;
			console.log(lineIndex, voiceFile);
			let ret = yield setVoiceFile(db, 'AiryFairy', _fileName, lineIndex, voiceFile);
			// console.log(ret);
		}
		// break;
	}
}))().catch(err => console.log(err));
