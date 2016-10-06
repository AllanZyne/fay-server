"use strict";

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const { async, access } = require('../lib/async.js');
const database = require('../lib/database.js');


let verbose = true;

function hashPassword(data) {
    return new Promise((resolve, reject) => {
        bcrypt.genSalt(10, function(err, salt) {
            if (! err)
                bcrypt.hash(data, salt, function(err, hash) {
                    if (! err)
                        resolve(hash);
                    else
                        reject(err);
                });
            else
                reject(err);
        });
    });
}

/*

用户管理

user-add USERID PASSWORD TYPE
TYPE:
   0: ????
   1: WRITE  翻译
   2: READ   读者
user-remove USERID
user-update USERID [-p PASSWORD] [-t TYPE]
user-list [USERID]
*/

let user = async(function*(cmd, cmdArgs) {
    let db = yield database.connect().catch(err => { throw err; });
    let result;

    if (cmd[1] == 'add') {
        let [username, password, type] = cmdArgs;
        if (! (username && password && type))
            help(cmd);
        password = yield hashPassword(password);
        result = yield database.user_add(db, username, password, type).catch(err => { throw err; });
    } else if (cmd[1] == 'remove') {
        let [ username ] = cmdArgs;
        if (! username)
            help(cmd);
        result = yield database.user_delete(db, username).catch(err => { throw err; });
    } else if (cmd[1] == 'list') {
        let [ username ] = cmdArgs;
        result = yield database.user_list(db, username).catch(err => { throw err; });
    }

    result.connection = undefined;
    result.message = undefined;
    console.log(result);

    yield db.close();
});


// 项目管理
//
// proj-add PROJNAME PATH
// proj-remove PROJNAME
// proj-update PROJNAME
// proj-list PROJNAME
//
var proj = async(function*() {
    if (verbose)
        console.warn('connect to database...');

    let db = yield database.connect().catch(err => { throw err; });
    let result;

    if (verbose)
        console.warn('connected...');

    if (cmd[1] == 'add') {
        let [name, providerPath] = cmdArgs;
        if (! (name && path))
            help(cmd);
        if (! path.isAbsolute(providerPath))
            providerPath = path.join(process.cwd(), providerPath);
        console.log('project add', name, providerPath);
        let provider = require(path.join(providerPath, '_.js'));
        result = yield database.project_add(db, name, provider, { verbose: true }).catch(err => { throw err; });
    } else if (cmd[1] == 'remove') {
        let [ name ] = cmdArgs;
        if (! name)
            help(cmd);
        console.log('project remove', name);
        result = yield database.project_remove(db, name).catch(err => { throw err;});
    } else if (cmd[1] == 'list') {
        let [ name ] = cmdArgs;
        console.log('project list', name);
        result = yield database.project_list(db, name).catch(err => { throw err;});
    } else {
        help(cmd);
    }

    if (verbose) {
        console.warn('!!result');
        console.dir(result, {colors:true});
    }

    yield db.close();
});


// 帮助
function help(cmd) {
    if (! cmd) {
        console.log();
        console.log('Usage: node data.js <cmd> [...]');
        console.log();
        console.log('PROJECT');
        console.log('-----------------------------------');
        console.log('proj-add PROJNAME PATH');
        console.log('proj-remove PROJNAME');
        console.log('proj-update PROJNAME');
        console.log('proj-list PROJNAME');
        console.log();
        console.log('USER');
        console.log('-----------------------------------');
        console.log('user-add USERNAME PASSWORD TYPE');
        console.log('user-remove USERNAME');
        console.log('user-update USERNAME [-p PASSWORD] [-t TYPE]');
        console.log('user-list [USERNAME]');
        console.log();
        console.log('npm <cmd> -h  quck help on <cmd>');
        console.log();
    } else {
        console.log('Help:', cmd);
    }

    process.exit(-1);
}

function error(message) {
    console.error(message);
    process.exit(1);
}


let argv = process.argv.slice(2);
let cmd = argv[0] ? argv[0].split('-') : [];
let cmdArgs = argv.slice(1);

if (cmd[0] == 'user')
    user(cmd, cmdArgs).catch(error);
else if (cmd[0] == 'proj')
    proj(cmd, cmdArgs).catch(error);
else
    help();
