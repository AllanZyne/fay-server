"use strict";

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');

const { MongoClient, ObjectID } = require('mongodb');

const { async, access } = require('./async.js');
const config = require('../config.js');


// -----------------------------------------------------------------------------

// http://stackoverflow.com/questions/31089801/extending-error-in-javascript-with-es6-syntax
class ExtendableError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        this.message = message;
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = (new Error(message)).stack;
        }
    }
}

class UserError extends ExtendableError {
    constructor(m) {
        super(m);
    }
}

class ProjectError extends ExtendableError {
    constructor(m) {
        super(m);
    }
}

// -----------------------------------------------------------------------------

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

// http://stackoverflow.com/questions/18638900/javascript-crc32
function makeCRCTable() {
    let c;
    let crcTable = [];
    for(let n =0; n < 256; n++){
        c = n;
        for(let k =0; k < 8; k++){
            c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }
    return crcTable;
}
var crcTable = makeCRCTable();
function crc32(str) {
    let crcTable = crcTable;
    let crc = 0 ^ (-1);

    for (let i = 0; i < str.length; i++ ) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
    }

    crc = (crc ^ (-1)) >>> 0;
    return ('00000000' + crc.toString(16)).slice(-8);
}

// -----------------------------------------------------------------------------

function connect(name) {
    return MongoClient.connect(config.database);
}

let user_add = function(db, userId, name, password, type) {
    let userCol = db.collection('users');

    let typeno = parseInt(type, 10);
    if (typeno < 0 || typeno > 2)
        throw new UserError('未定义权限：' + type);

    return hashPassword(password).then(password => {
        return userCol.insertOne({
            _id: userId,
            name: name,
            password: password,
            type: typeno
        });
    }).catch(err => {
        throw new UserError(err);
    });
};

let user_delete = function(db, userId) {
    let userCol = db.collection('users');
    return userCol.deleteOne({ _id: userId }).catch(err => {
        throw new UserError(err);
    });
};

let user_update = function(db, userId, options) {
    let userCol = db.collection('users');
    let { name, password, type } = options;

    let doc = {};
    if (name && name.length)
        doc.name = name;
    if (password && password.length)
        doc.password = hashPassword(password);
    if (type >= 0 && type <= 2)
        doc.type = type;
    else
        throw new UserError('未定义权限：', type);

    return userCol.update({ _id: userId }, {
        $set: doc
    }).catch(err => { throw new UserError(err); });
};

let user_list = function(db, userId) {
    let userCol = db.collection('users');
    return userCol.find().toArray();
};

var insertDocument = async(function*(doc, targetCollection) {
    for (;;) {
        let data = yield targetCollection.find({}, { _id: 1 }).sort({ _id: -1 }).limit(1).toArray();
        // console.log('data', data);
        let seq = data.length ? data[0]._id + 1 : 0;
        doc._id = seq;
        // console.log(seq);
        try {
            return yield targetCollection.insertOne(doc).catch(err => {
                throw err;
            });
        } catch (err) {
            if (err.code == 11000) { /* dup key */
                continue;
            } else {
                throw new Error("unexpected error inserting data!");
            }
        }
    }
});


var setProvider = async(function*(db, provider) {
    let projectsCol = db.collection('projects'),
        filesCol = db.collection('files'),
        linesCol = db.collection('lines'),
        translinesCol = db.collection('translines');

    let result = yield insertDocument({
        name: provider.name,
        lock: false,
        linesCount: 0,
        transCount: 0,
        locksCount: 0,
    }, projectsCol);

    let projectId = result.insertedId;
    console.log(projectId);

    let now = new Date();
    let sameTexts = {};

    let files = yield provider.getFileList();
    let projLinesCount = 0;
    let projTransCount = 0;

    for (let fileIndex = 0, fileLen = files.length; fileIndex < fileLen; fileIndex++) {
        let fileId = (projectId << 8) + fileIndex,
            file = files[fileIndex];

        console.log(file);

        let lines = yield provider.getOriginalLines(file);
        let translines = yield provider.getTranslatedLines(file);
        let transCount = 0;
        // console.log(translines);

        for (let lineIndex = 0, lineLen = lines.length; lineIndex < lineLen; lineIndex++) {
            let text = lines[lineIndex];
            let transtext = translines[lineIndex];
            let lineId = (fileId << 12) + lineIndex;
            let transId = null;

            // console.log(lineIndex);

            if (transtext && transtext.length) {
                transId = lineId << 4;
                let results = yield translinesCol.insertOne({
                    _id: transId,
                    text: transtext,
                    userId: null,
                    time: now,
                });
                transCount++;
            }

            yield linesCol.insertOne({
                _id: lineId,
                text: text,
                transId: transId,
                status: transId === null ? 0 : 2, // 0: 未翻译 1: 继承翻译 2：翻译
                lock: false,
                sameGroup: null
            });

            let sames = sameTexts[text] ? sameTexts[text] : [];
            sames.push(lineId);
            if (transId)
                sames.transId = transId;
            sameTexts[text] = sames;
        }

        yield filesCol.insertOne({
            _id: fileId,
            name: file,
            lock: false,
            linesCount: lines.length,
            transCount: transCount,
            locksCount: 0,
        });

        projLinesCount += lines.length;
        projTransCount += transCount;
    }

    yield projectsCol.updateOne({
        _id: projectId
    }, {
        $set: {
            linesCount: projLinesCount,
            transCount: projTransCount,
        }
    });

    let sameGroup = 0;
    for (let text in sameTexts) {
        let sames = sameTexts[text];
        if (sames.length > 1) {
            // console.log(sameGroup, sames);

            yield linesCol.updateMany( {
                $or: sames.map(id => { return {_id: id}; })
            }, {
                $set: {
                    sameGroup: sameGroup,
                }
            }, {
                w: 1,
                multi: true,
            });

            if (sames.transId) {
                yield linesCol.updateMany({
                    sameGroup: sameGroup,
                    status: 0,
                }, {
                    $set: {
                        transId: sames.transId,
                        status: 1,
                    }
                }, {
                    w: 1,
                    multi: true,
                });
            }

            sameGroup++;
        }
    }

});

let project_list = function(db, projectId) {
    let projectsCol = db.collection('projects');
    if (projectId === undefined) {
        return projectsCol.find({}, { _id: 0 }).sort({ _id: 1 }).toArray();
    } else {
        return projectsCol.find({ _id: projectId }, { _id: 0 }).toArray();
    }
};

let files_list = function(db, projectId, fileId) {
    let filesCol = db.collection('files');
    projectId = (projectId & 0xff) << 8;

    if (fileId === undefined) {
        fileId = {
            $gte: projectId,
            $lte: projectId | 0xff,
        };
    } else {
        fileId = projectId + (fileId & 0xff);
    }

    return filesCol.find({
        _id: fileId
    }, { _id: 0 }).sort({ _id: 1 }).toArray();
};

let lines_list = function(db, projectId, fileId, lineId) {
    let linesCol = db.collection('lines');

    projectId = (projectId & 0xff) << 8;
    fileId = (projectId + (fileId & 0xff)) << 12;

    if (lineId === undefined) {
        lineId = {
            $gte: fileId,
            $lte: fileId | 0xfff,
        };
    } else {
        lineId = fileId + (lineId & 0xfff);
    }

    return linesCol.aggregate([{
        $match: {
            _id: lineId
        }
    }, {
        $lookup: {
            from: 'translines',
            localField: 'transId',
            foreignField: '_id',
            as: 'transline_doc',
        }
    }], {
        cursor: { batchSize: 1 }
    }).sort({ _id: 1 }).toArray().then(data => data.map((line) => {
        // console.log(line.transline_doc);
        if (line.transline_doc.length) {
            line.transtext = line.transline_doc[0].text;
            line.userId = line.transline_doc[0].userId;
            line.time = line.transline_doc[0].time;
            line.transline_doc = undefined;
        } else {
            line.transline_doc = undefined;
        }
        line._id = undefined;
        return line;
    }));
};

let trans_list = function(db, projectId, fileId, lineId) {
    let translinesCol = db.collection('translines');

    projectId = (projectId & 0xff) << 8;
    fileId = (projectId + (fileId & 0xff)) << 12;
    lineId = (fileId + lineId) << 4;

    return translinesCol.find({
        _id: {
            $gte: lineId,
            $lte: lineId | 0xf,
        }
    }, { _id: 0 }).sort({ time: 1 }).toArray();
};

// !! check locks
let insert_trans = async(function*(db, lineId, text, userId) {
    let linesCol = db.collection('lines'),
        translinesCol = db.collection('translines');

    let lines = yield linesCol.find({ _id: lineId }, { transId: 1, sameGroup: 1 }).toArray();

    let transId = lines[0].transId;
    if (transId) {
        if ((transId & 0xf) == 0xf)
            transId = lineId << 4;
        else
            transId++;
    } else {
        transId = 0;
    }

    yield linesCol.updateOne({
        _id: lineId
    }, {
        $set: {
            transId: transId,
            status: 2,
        }
    }).catch(err => console.log(err));

    if (lines[0].sameGroup !== null) {
        yield linesCol.updateMany({
            sameGroup: lines[0].sameGroup,
            status: 1,
        }, {
            $set: {
                transId: transId
            }
        }, {
            w: 1,
            multi: true,
        }).catch(err => console.log(err));
    }

    return translinesCol.updateOne({
        _id: transId
    }, {
        $set: {
            _id: transId,
            text: text,
            userId: userId,
            time: new Date()
        }
    }, {
        upsert: true,
        w: 1,
    }).catch(err => console.log(err));

});



exports.connect = connect;
exports.user_add = user_add;
exports.user_list = user_list;
exports.user_update = user_update;
exports.user_delete = user_delete;
exports.project_list = project_list;
exports.files_list = files_list;
exports.lines_list = lines_list;
exports.trans_list = trans_list;
exports.insert_transline = insert_trans;
