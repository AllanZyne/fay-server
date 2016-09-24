"use strict";

const bcrypt = require('bcryptjs');
const { MongoClient, ObjectID } = require('mongodb');
const Boom = require('boom');

const { async, access } = require('./async.js');
const config = require('../config.js');


// -----------------------------------------------------------------------------

// TODO： 包装成返回 json 格式的错误信息
class MongoError {
    constructor(err) {
        this.name = 'MongoError';
        this.message = err.message;
        this.code = 500;
    }
}

// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------

var user_add = function(db, userId, name, password, type) {
    let userCol = db.collection('users');

    let typeno = parseInt(type, 10);
    if (isNaN(typeno) || typeno < 0 || typeno > 2)
        throw new MongoError('未定义权限：', type);

    return userCol.insertOne({
        _id: userId,
        name: name,
        password: password,
        type: typeno,
        time: new Date(),
    }).catch(err => {
        throw new MongoError(err);
    });
};

var user_remove = function(db, userId) {
    let userCol = db.collection('users');
    return userCol.deleteOne({ _id: userId }).catch(err => {
        throw new MongoError(err);
    });
};

var user_update = function(db, userId, options) {
    let userCol = db.collection('users');
    let { name, password, type } = options;

    let doc = {};
    if (name && name.length)
        doc.name = name;
    if (password && password.length)
        doc.password = password;
    if (type >= 0 && type <= 2)
        doc.type = type;
    else
        throw new MongoError('未定义权限：', type);

    return userCol.update({ _id: userId }, {
        $set: doc
    }).catch(err => { throw new MongoError(err); });
};

var user_list = function(db, userId) {
    let userCol = db.collection('users');
    if (!userId)
        return userCol.find().toArray();
    else
        return userCol.find({_id:userId}).toArray();
};

// -----------------------------------------------------------------------------

var insertDocument = async(function*(doc, targetCollection) {
    for (;;) {
        let data = yield targetCollection.find({}, { _id: 1 })
            .sort({ _id: -1 })
            .limit(1)
            .toArray();
        // console.log('data', data);
        let seq = data.length ? data[0]._id + 1 : 0;
        doc._id = seq;
        // console.log(doc);
        try {
            return yield targetCollection.insertOne(doc);
        } catch (err) {
            if (err.code == 11000) { /* dup key */
                continue;
            } else {
                throw new Error("unexpected error inserting data!");
            }
        }
    }
});

var project_add = async(function*(db, name, provider, options) {
    let projectsCol = db.collection('projects'),
        filesCol = db.collection('files'),
        linesCol = db.collection('lines'),
        translinesCol = db.collection('translines');
    let verbose = options.verbose;
    let now = new Date();

    yield projectsCol.createIndex('name', {
        w:1, unique: true, background: true
    });

    if (verbose)
        console.log('[project_add] insertDocument');

    let data = yield projectsCol.find({ name: name }).toArray();
    if (data.length) {
        console.log('[project_add] project name duplicate!!');
        return;
    }

    let result = yield insertDocument({
        name: name,
        lock: false,
        linesCount: 0,
        transCount: 0,
        locksCount: 0,
        time: now,
    }, projectsCol);

    let projectId = result.insertedId;
    if (verbose)
        console.log('[project_add] projectId', projectId);

    let sameTexts = {};

    let files = yield provider.getFileList();
    let projLinesCount = 0;
    let projTransCount = 0;

    for (let fileIndex = 0, fileLen = files.length; fileIndex < fileLen; fileIndex++) {
        let fileId = (projectId << 8) + fileIndex,
            file = files[fileIndex];

        if (verbose)
            console.log(file);

        let lines = yield provider.getOriginalLines(file);
        let translines = yield provider.getTranslatedLines(file);
        let transCount = 0;
        // console.log(translines);

        for (let lineIndex = 0, lineLen = lines.length; lineIndex < lineLen; lineIndex++) {
            let text = lines[lineIndex];
            let transtext = translines[lineIndex];
            let lineId = (fileId << 12) + lineIndex;
            let commits = [];

            if (transtext && transtext.length) {
                commits.push({
                    text: transtext,
                    userId: 'allan',
                    time: now,
                });
                transCount++;
            }

            yield translinesCol.insertOne({
                _id: lineId,
                commits: commits
            });

            yield linesCol.insertOne({
                _id: lineId,
                text: text,
                lock: false,
                sameGroup: null
            });

            let sames = sameTexts[text] ? sameTexts[text] : [];
            sames.push(lineId);
            if (commits.length)
                sames.transId = lineId;
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

var project_remove = async(function*(db, projectName) {
    let projectsCol = db.collection('projects'),
        filesCol = db.collection('files'),
        linesCol = db.collection('lines'),
        transCol = db.collection('translines');

    let result = yield projectsCol.findOneAndDelete({name: projectName});
    console.log(result);
    if (! result.value) {
        console.log('[project_remove] project name does not exist!');
        return;
    }
    let projectId = result.value._id;
    let fileId = projectId << 8;
    yield filesCol.deleteMany({_id: { $gte: fileId, $lte: fileId | 0xff, }});
    let lineId = fileId << 12;
    yield linesCol.deleteMany({_id: { $gte: lineId, $lte: lineId | 0xfffff, }});
    yield transCol.deleteMany({_id: { $gte: lineId, $lte: lineId | 0xfffff, }});
});

var project_list = function(db, projectName, options) {
    let projectsCol = db.collection('projects');
    if (projectName === undefined) {
        return projectsCol.find({}).toArray();
    } else {
        return projectsCol.find({ name: projectName }).toArray().then(results => {
            if (! results.length)
                return Boom.badRequest(`project '${projectName}' doesn't exist!`);
            return results;
        });
    }
};

var project_lock = function(db, projectName, lock) {
    let projectsCol = db.collection('projects');
    return projectsCol.updateOne({
        name: projectName
    }, {
        lock: lock
    });
};

var files_list = function(db, projectName, fileName, options) {
    console.log('[files_list]', projectName, fileName, options);
    return project_list(db, projectName).then((results) => {
        if (results.isBoom)
            return results;

        if (! results.length)
            return [];

        console.log('[files_list]', results);

        // if (results[0].lock) {
        //     return Boom.forbidden(`project '${results[0].name}' is locked!`);
        // }

        let projectId = results[0]._id;
        projectId <<= 8;

        let filesCol = db.collection('files');
        let query = {
            _id: {
                $gte: projectId,
                $lte: projectId | 0xff,
            }
        };
        if (typeof fileName === 'string') {
            query.name = fileName;
        }

        console.log('[files_list] find');

        return filesCol.find(query).toArray().then(results => {
            if (! results.length)
                return Boom.badRequest(`file '${fileName}' doesn't exist!`);
            return results;
        });
    });
};

var files_lock = function(db, projectName, fileName, lock) {
    return project_list(db, projectName).then((results) => {
        if (results.isBoom)
            return results;

        if (! results.length)
            return {};

        let projectId = results[0]._id;
        projectId <<= 8;

        let filesCol = db.collection('files');
        return filesCol.updateOne({
            _id: {
                $gte: projectId,
                $lte: projectId | 0xff,
            },
            name: fileName
        }, {
            lock: lock
        });
    });
};

var lines_list = function(db, projectName, fileName, lineId, options) {
    return files_list(db, projectName, fileName).then((results) => {
        // console.log('lines_list', results);

        if (results.isBoom)
            return results;

        if (! results.length)
            return [];

        // if (results[0].lock) {
        //     return Boom.forbidden(`file '${results[0].name}' is locked!`);
        // }

        let fileId = results[0]._id;
        fileId <<= 12;

        let linesCol = db.collection('lines');

        if (lineId !== undefined) {
            return linesCol.find({
                _id: fileId | lineId
            }).toArray();
        }

        let page = options.page, per_page = options.per_page;
        let findPromise;

        if (options.per_page < 0) {
            findPromise = linesCol.find({
                _id: {
                    $gte: fileId,
                    $lt: fileId | 0xfff,
                }
            }).toArray();
        } else {
            let lineIdStart = page * per_page,
                lineIdEnd = lineIdStart + per_page;

            findPromise = linesCol.find({
                _id: {
                    $gte: fileId | lineIdStart,
                    $lt: fileId | lineIdEnd,
                }
            }).toArray();
        }

        return findPromise;
    });
};

var trans_list = function(db, projectName, fileName, lineId, options) {
    return files_list(db, projectName, fileName).then((results) => {
        console.log('[trans_list] files', results);

        if (results.isBoom)
            return results;

        if (! results.length)
            return [];

        let fileId = results[0]._id;
        fileId <<= 12;

        let transCol = db.collection('translines');

        if (lineId !== undefined) {
            console.log('[trans_list] fineOne', lineId);
            return transCol.find({
                _id: fileId | lineId
            }).toArray();
        }

        let page = options.page, per_page = options.per_page;
        let findPromise;

        console.log('[trans_list] fineMany', per_page, fileId);

        if (per_page < 0) {
            findPromise = transCol.find({
                _id: {
                    $gte: fileId,
                    $lt: fileId | 0xfff,
                }
            }).toArray();
        } else {
            let lineIdStart = page * per_page,
                lineIdEnd = lineIdStart + per_page;
            findPromise = transCol.find({
                _id: {
                    $gte: fileId | lineIdStart,
                    $lt: fileId | lineIdEnd,
                }
            }).toArray();
        }

        return findPromise;
    });
};


var insert_trans = async(function*(db, projectName, fileName, lineId, text, userId) {
    let projectsCol = db.collection('projects'),
        filesCol = db.collection('files'),
        linesCol = db.collection('lines'),
        transCol = db.collection('translines');

    let projects = yield projectsCol.find({name: projectName}).toArray();
    console.log('[trans_add] projects', projects);

    if (! projects.length)
        return Boom.badRequest(`project '${projectName}' doesn't exist!`);
    if (projects[0].lock)
        return Boom.forbidden(`project '${projectName}' is locked!`);

    let projectId = projects[0]._id;

    let files = yield filesCol.find({
        _id: {
            $gte: projectId,
            $lte: projectId | 0xff,
        },
        name: fileName
    }).toArray();

    console.log('[trans_add] files', files);

    if (! files.length)
        return Boom.badRequest(`file '${fileName}' doesn't exist!`);
    if (files[0].lock)
        return Boom.forbidden(`file '${fileName}' is locked!`);

    let fileId = files[0]._id;
    let _lineId = fileId << 12 | lineId;

    let lines = yield linesCol.find({_id: _lineId}).toArray();

    console.log('[trans_add] lines', lines);

    if (! lines.length)
        return Boom.badRequest(`line '${lineId}' doesn't exist!`);
    if (lines[0].lock)
        return Boom.forbidden(`line '${lineId}' is locked!`);

    // -------------------------------------------------------------------------

    let sameGroup = lines[0].sameGroup;
    let lineIds = [_lineId];

    if (typeof sameGroup === 'number') {
        let lines = yield linesCol.find({ sameGroup: sameGroup },
            { _id: 1, lock: 1 }).toArray();
        lineIds = [];
        console.log('[trans_add] sameGroup', lines);
        for (let line of lines) {
            if (! line.lock)
                lineIds.push(line._id);
        }
    }

    console.log('[trans_add] lineIds', lineIds);

    let result;
    for (let id of lineIds) {
        result = yield transCol.updateOne({_id: id}, {
            $push: {
                'commits': {
                    text: text,
                    userId: userId,
                    time: new Date(),
                }
            }
        });

        result = yield filesCol.updateOne({
            _id: id >> 12
        }, {
            $inc: {
                'transCount': 1
            }
        });
    }

    result = yield projectsCol.updateOne({
        _id: projectId
    }, {
        $inc: {
            'transCount': lineIds.length
        }
    });

    return {
        message: 'success',
        lineIds: lineIds
    };
});

// -----------------------------------------------------------------------------

var vocabulary_list = function(db) {
    let vacabularyCol = db.collection('vacabulary');
    return vacabularyCol.find().sort({ time: 1 }).toArray();
};

var vocabulary_add = function(db, key, value, userId) {
    let vacabularyCol = db.collection('vacabulary');
    return vacabularyCol.insertOne({
        _id: key,
        value: value,
        userId: userId,
        time: new Date(),
    });
};

var vocabulary_remove = function(db, key) {
    let vacabularyCol = db.collection('vacabulary');
    return vacabularyCol.deleteOne({
        _id: key,
    });
};

// -----------------------------------------------------------------------------

var session_list = function(db, sessionId) {
    let sessionCol = db.collection('session');
    return sessionCol.find({_id: sessionId}).toArray();
};

var session_add = function(db) {
    let sessionCol = db.collection('session');
    return sessionCol.insertOne({
        insertTime: new Date()
    }).then(result => result.insertedId.toString());
};

var session_remove = function(db, sessionId) {
    let sessionCol = db.collection('session');
    return sessionCol.deleteOne({_id: sessionId});
};

var session_clean = function(db) {
    let sessionCol = db.collection('session'),
        now = Date().now();
    return sessionCol.deleteMany({
        insertTime: {
            $lt: new Date(now.getFullYear(), now.getMonth(), now.getDay(),
                          now.getHours() - 1, 0, 0)
        }
    });
};

// -----------------------------------------------------------------------------

exports.connect = connect;

exports.user_add = user_add;
exports.user_list = user_list;
exports.user_update = user_update;
exports.user_remove = user_remove;

exports.project_add = project_add;
exports.project_remove = project_remove;
exports.project_list = project_list;

exports.files_list = files_list;
exports.lines_list = lines_list;
exports.trans_list = trans_list;
exports.trans_add = insert_trans;

exports.vocabulary_list = vocabulary_list;
exports.vocabulary_add = vocabulary_add;
exports.vocabulary_remove = vocabulary_remove;

exports.session_list = session_list;
exports.session_add = session_add;
exports.session_remove = session_remove;
exports.session_clean = session_clean;
