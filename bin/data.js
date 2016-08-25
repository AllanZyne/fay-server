"use strict";

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const { async, access } = require('../lib/async.js');
const database = require('../lib/database.js');


/*

用户管理

user-add USERID NAME PASSWORD TYPE
TYPE:
   0: ????
   1: WRITE  翻译
   2: READ   读者
user-remove USERID
user-update USERID [-p PASSWORD] [-t TYPE]
user-list [USERID]
*/

let user = async(function*(cmd, cmdArgs) {
    let db = yield database.connect().catch(err => { throw err;});
    let result;

    if (cmd[1] == 'add') {
        let [userId, name, password, type] = cmdArgs;
        if (! (userId && name && password && type))
            help(cmd);
        result = yield database.user_add(db, name, password, type).catch(err => { throw err;});
    } else if (cmd[1] == 'remove') {
        let [ userId ] = cmdArgs;
        if (! userId)
            help(cmd);
        result = yield database.user_delete(db, userId).catch(err => { throw err;});
    } else if (cmd[1] == 'list') {
        let [ userId ] = cmdArgs;
        result = yield database.user_list(db, userId).catch(err => { throw err;});
    }

    console.log(result);

    return yield db.close();
});


// 项目管理
//
// proj-add name PATH
// proj-remove name
// proj-update name
// proj-list name
//
var proj = async(function*() {
    let db = yield database.connect().catch(err => { throw err;});
    let result;

    if (cmd[1] == 'add') {
        let [userId, name, password, type] = cmdArgs;
        if (! (userId && name && password && type))
            help(cmd);
        result = yield database.user_add(db, name, password, type).catch(err => { throw err;});
    } else if (cmd[1] == 'remove') {
        let [ userId ] = cmdArgs;
        if (! userId)
            help(cmd);
        result = yield database.user_delete(db, userId).catch(err => { throw err;});
    } else if (cmd[1] == 'list') {
        let [ userId ] = cmdArgs;
        result = yield database.user_list(db, userId).catch(err => { throw err;});
    } else {
        help(cmd);
    }

    console.log(result);

    return yield db.close();
});


// 帮助
function help(cmd) {
    if (! cmd) {
        console.log();
        console.log('Usage: node data.js <CMD>');
        console.log();
        console.log('where <CMD> is one of:');
        console.log('user, proj');
        console.log();
        console.log('npm <CMD> -h  quck help on <CMD>');
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
