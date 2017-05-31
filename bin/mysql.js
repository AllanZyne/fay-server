"use strict";

const { async, access } = require('../lib/async.js');
const config = require('../lib/config.js');
const mysqlx = require('@mysql/xdevapi');
const mysql = require('mysql2/promise');

const database = require('../lib/database.js');


function toMysqlFormat(date) {
	if (date)
		return date.toISOString().slice(0, 19).replace('T', ' ');
	else
		return (new Date()).toISOString().slice(0, 19).replace('T', ' ');
}

function connect() {
	return mysql.createConnection({
		host:'localhost',
		user: 'root',
		password: 'LQSyM2501',
		database: 'fay'
	});
}

var saveProject = async(function*() {
	let session = yield mysqlx.getSession({
		host: 'localhost',
		port: '33060',
  		dbUser: 'root',
  		dbPassword: 'LQSyM2501'
	});
	let db = yield session.getSchema('fay');
	let table = yield db.getTable('project');

	let mdb = yield database.connect();
	let projects = yield database.project_list(mdb);
	console.log(projects);

	for (let project of projects) {
		let ret = yield table.insert(['name', 'lock', 'lines_count', 'trans_count', 'locks_count', 'create_time'])
		    .values(project.name, project.lock ? 1 : 0, project.linesCount, project.transCount, project.locksCount, toMysqlFormat(project.time))
			.execute();
		console.log(ret);
	}
});

// saveProject();

var saveFiles = async(function*(projectName) {
	let conn = yield connect();

	let [rows, fields] = yield conn.query('select `id`, `create_time` from `project` where `name` = ?', [projectName]);
	let project_id = rows[0].id,
		project_time = rows[0].create_time;

	// console.log(project_id, project_time);

	let mdb = yield database.connect();
	let files = yield database.files_list(mdb, projectName);
	// console.log(files);

	for (let file of files) {
		let ret = yield conn.query(
			'insert into `file` ' +
			'(`project_id`, `name`, `lock`, `lines_count`, `trans_count`, `locks_count`, `create_time`) ' +
			'values (?, ?, ?, ?, ?, ?, ?)', [
				project_id, file.name, file.lock ? 1 : 0,
				file.linesCount, file.transCount, file.locksCount,
				toMysqlFormat(project_time)
			]);
		console.log(ret);
	}

});

// saveFiles('AiryFairy').catch(err => console.log(err));

function userType(type) {
	switch (type) {
		case 0:
			return 'ADMIN';
		case 1:
			return 'WRITER';
		case 2:
			return 'READER';
		default:
			return 'READER';
	}
}

var saveUsers = async(function*() {
	let conn = yield connect();

	let mdb = yield database.connect();
	let users = yield database.user_list(mdb);
	// console.log(users);

	for (let user of users) {
		let ret = yield conn.query(
			'insert into `user`' +
			'(`name`, `password`, `email`, `type`, `create_time`) ' +
			'values (?, ?, ?, ?, ?)',
			[user._id, user.password, user.email,
			userType(user.type), toMysqlFormat(user.createTime)]
			);
		console.log(ret);
	}
});

// saveUsers().catch(err => console.log('ERROR', err));

var saveLines = async(function*(projectName) {
	let conn = yield connect();

	let [rows, fields] = yield conn.query('select `id`, `create_time` from `project` where `name` = ?', [projectName]);
	let project_id = rows[0].id,
		project_time = rows[0].create_time;

	[rows, fields] = yield conn.query('select `id`, `name` from `file` where `project_id` = ?', [project_id]);
	// console.log(rows);

	let mdb = yield database.connect();

	for (let row of rows) {
		let file_name = row.name, file_id = row.id;
		let lines = yield database.lines_list(mdb, projectName, file_name, undefined, { per_page: -1 });
		// console.log(lines);

		console.log(file_id, file_name);

		for (let line of lines) {
			let transline_id = null;
			let ret = yield conn.query('insert into `line` ' +
				'(`file_id`, `text`, `lock`, `modified_time`) ' +
				'values (?, ?, ?, ?)', [
					file_id, line.text, line.lock ? 1 : 0, toMysqlFormat(line.time)
				]);
			let line_id = ret[0].insertId;
			// console.log('line_id', line_id);
			if (line.transText) {
				let [rows, fields] = yield conn.query(
					'select `id` from `user` where `name` = ?', [ line.userId ]);
				let user_id = rows[0].id;
				// console.log('user_id', user_id);
				let ret = yield conn.query('insert into `transline` ' +
					'(`line_id`, `text`, `user_id`, `create_time`) ' +
					'values (?, ?, ?, ?)', [
						line_id, line.transText, user_id, toMysqlFormat(line.time)
					]);
				// let transline_id = ret[0].insertId;
				// console.log('transline_id', transline_id);
				// ret = yield conn.query(
				// 	'update `line` set `transline_id` = ? where `id` = ?',
				// 	[ transline_id, line_id ]);
			}

			// break;
		}
		// break;
	}
});

saveLines('AiryFairy').catch(err => console.log(err));
