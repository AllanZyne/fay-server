"use strict";

const bcrypt = require('bcryptjs');
const Boom = require('boom');
const mysql = require('mysql2/promise');
const _ = require('lodash');

const { async, access } = require('./async.js');
const config = require('./config.js');

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function connect() {
	return mysql.createConnection({
		host:'localhost',
		user: 'root',
		password: 'LQSyM2501',
		database: 'fay'
	});
}

function resolveOneRow(badRequestMsg) {
	return ([rows, fields]) => {
		return new Promise((resolve, reject) => {
			if (rows.length)
				resolve(rows[0]);
			else
				reject(Boom.badRequest(badRequestMsg));
		});
	};
}

function resolveRows(results) {
	return results[0];
}

// -----------------------------------------------------------------------------
// User
// -----------------------------------------------------------------------------

function user_add(_, name, password, type) {
	return connect().then(conn => {
		return conn.query('insert into `user` (`name`, `password`, `type`) ' +
					      ' values (?, ?, ?)', name, password, type);
	});
}

function user_list(_, userId) {
	return connect().then(conn => {
		if (userId)
			return conn.query('select ' +
				'`id`, `name`, `email`, `type` from `user` ' +
				'where `userId` = ?', [userId]).then(resolveOneRow(`user ${userId} is not found`));
		return conn.query('select ' +
			'`id`, `name`, `email`, `type` from `user`').then(resolveRows);
	});
}

function user_update(_, userId, options) {
	return connect().then(conn => {

	});
}

function user_remove(_, userId) {
	return connect().then(conn => {
		return conn.query('delete from `user` where `id` = ?', [userId]);
	});
}

function user_auth(_, name) {
	return connect().then(conn => {
		return conn.query('select ' +
			'`id`, `name`, `email`, `type`, `password` from `user` ' +
			'where `name` = ?', [name]).then(resolveOneRow(`user <${name}> is not found`));
	});
}

// -----------------------------------------------------------------------------
// Notify
// -----------------------------------------------------------------------------

function notify_list(userId) {

}

function notify_add(userId, notify) {

}

function notify_reset(userId) {

}

function notify_remove(notifyId) {

}

// -----------------------------------------------------------------------------
// Projects
// -----------------------------------------------------------------------------

function project_list() {

}

function project_findOne(_, projectName) {
	return connect().then(conn => {
		return conn.query('select `id` from `project` where `name` = ?', [projectName])
			.then(resolveOneRow(`project <${projectName}> is not found`));
	});
}

function project_add() {

}

function project_remove() {

}

function files_list(_, projectName, options) {
	return project_findOne(_, projectName).then(project => {
		return connect().then(conn => {
			return conn.query('select ' +
				'`id`, `name`, `lock`, `lines_count` as `linesCount`, ' + 
				'`trans_count` as `transCount`, `locks_count` as `locksCount`, ' + 
				'`create_time` as `createTime`, `modified_time` as `modifiedTime` ' +
				'from `file` where `project_id` = ?', [project.id]).then(resolveRows);
		});
	});
}

function files_findOne(_, projectName, fileName) {
	return project_findOne(_, projectName).then(project => {
		return connect().then(conn => {
			return conn.query('select ' +
					'`id`, `name`, `lock`, `lines_count` as `linesCount`, ' + 
					'`trans_count` as `transCount`, `locks_count` as `locksCount`, ' + 
					'`create_time` as `createTime`, `modified_time` as `modifiedTime` ' +
					'from `file` where `project_id` = ? and `name` = ?', [project.id, fileName])
			    .then(resolveOneRow(`file <${fileName}> in project <${projectName}> is not found`));
		});
	});
}

function files_lock() {

}

function lines_list(__, projectName, fileName, options) {
	return files_findOne(__, projectName, fileName).then(file => {
		console.log('lines_list file', file);

		let options_ = _.defaults(options || {}, {
			page: 0,
			per_page: 50
		});

		return connect().then(conn => {
			let fileId = file.id;
			let { page, per_page } = options_;
			console.log('fileId', fileId, 'options', options_);
			return conn.query('select ' +
					'`line_id` as `id`, `text`, `transline_id` as `transId`, ' + 
					'`transtext` as `transText`, `lock`, `modified_time` as `modifiedTime` ' + 
					' from `line_list` where `file_id` = ? limit ?, ?',
				[fileId, page*per_page, per_page]).then(resolveRows);
		});
	});
}

function line_details(lineId) {
	if (! lineId) {
		return Boom.badRequest();
	}
	return connect().then(conn => {
		return conn.query('select `comment` from `line` where `line_id` = ?', [lineId])
			       .then(resolveOneRow(`line ${lineId} is not found`));
	});
}

function lines_lock(lineId, lock) {
	if (! lineId) {
		return Boom.badRequest();
	}
	lock = lock ? 1 : 0;
	return connect().then(conn => {
		return conn.query('update `line` set `lock` = ? where `line_id` = ?', [lock, lineId]);
	});
}


function transline_list(lineId) {
	if (! lineId) {
		return Boom.badRequest();
	}
	return connect().then(conn => {
		return conn.query('select * from ');
	});
}

function transline_insert(lineId, text, userId) {
	return connect().then(conn => {
		return conn.query(' insert into `transline`      ' +
		                  ' (`lineId`, `text`, `userId`) ' +
		                  ' values (?, ?, ?)             ' , [lineId, text, userId])
			.then(_ => {
				return conn.query('select `file_id` from `line` where `id` = ?', [lineId]);
			})
			.then(result => {
				if (result.length != 1)
					return Boom.badRequest();
				let fileId = result[0].file_id;
				return conn.query( ' update `file`                         ' +
				                   ' set `trans_count` = `trans_count` + 1 ' +
				                   ' where `id` = ?                        ' , [fileId]);
			});
	});
}

// -----------------------------------------------------------------------------
// Terms
// -----------------------------------------------------------------------------

function terms_list() {

}

function terms_add() {

}

function terms_remove() {

}

function terms_update() {

}



// -----------------------------------------------------------------------------
// Session
// -----------------------------------------------------------------------------

function session_list() {

}

function session_add() {

}

function session_remove() {

}

function session_clean() {

}



exports.connect = connect;

exports.user_add = user_add;
exports.user_list = user_list;
exports.user_update = user_update;
exports.user_remove = user_remove;
exports.user_auth = user_auth;

exports.notify_add = notify_add;
exports.notify_reset = notify_reset;
exports.notify_remove = notify_remove;

exports.project_add = project_add;
exports.project_remove = project_remove;
exports.project_list = project_list;
// exports.project_lock = project_lock;

exports.files_list = files_list;
exports.files_findOne = files_findOne;
exports.files_lock = files_lock;

exports.lines_list = lines_list;
exports.lines_lock = lines_lock;
// exports.lines_add = lines_add;

exports.transline_insert = transline_insert;

exports.terms_list = terms_list;
exports.terms_add = terms_add;
exports.terms_remove = terms_remove;
exports.terms_update = terms_update;

exports.session_list = session_list;
exports.session_add = session_add;
exports.session_remove = session_remove;
exports.session_clean = session_clean;
