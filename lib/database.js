"use strict";

const bcrypt = require('bcryptjs');
const { MongoClient, ObjectID } = require('mongodb');
const Boom = require('boom');

const { async, access } = require('./async.js');
const config = require('./config.js');


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

function connect(name) {
    return MongoClient.connect(config.database);
}

// -----------------------------------------------------------------------------

var user_add = function(db, userId, password, type) {
    let userCol = db.collection('users');

    let typeno = parseInt(type, 10);
    if (isNaN(typeno) || typeno < 0 || typeno > 2)
        throw new MongoError('未定义权限：', type);

    return userCol.insertOne({
        _id: userId,
        password: password,
        email: null,
        type: typeno,
        createTime: new Date(),
        notifies: [],
        newNotify: 0,
    });
};

var user_update = function(db, userId, options) {
    let userCol = db.collection('users');
    return userCol.update({ _id: userId }, {
        $set: options
    });
};

var user_list = function(db, userId) {
    let userCol = db.collection('users');
    if (!userId)
        return userCol.find({}, { notifies: 0, password: 0 }).toArray();
    else
        return userCol.find({ _id: userId }, { notifies: 0, password: 0 }).toArray()
            .then(results => {
                if (! results.length)
                    return Boom.badRequest(`user '${userId}' doesn't exist!`);
                return results[0];
            });
};

var user_remove = function(db, userId) {
    let userCol = db.collection('users');
    return userCol.deleteOne({ _id: userId }).then(_ => { return { message: 'success' }; });
};

var user_auth = function(db, userId) {
    let userCol = db.collection('users');
    return userCol.find({ _id: userId }, { notifies: 0 }).toArray()
        .then(results => {
            if (! results.length)
                return Boom.badRequest(`user '${userId}' doesn't exist!`);
            return results[0];
        });
};

// -----------------------------------------------------------------------------

var notify_list = function(db, userId) {
    let userCol = db.collection('users');
    return userCol.find({ _id: userId }, { notifies: 1 }).toArray()
        .then(results => {
            if (! results.length)
                return Boom.badRequest(`user '${userId}' doesn't exist!`);
            return results[0].notifies;
        });
};

var notify_add = function(db, userId, notify) {
    let userCol = db.collection('users');
    notify._id = new ObjectID();
    return userCol.updateOne({ _id: userId }, {
        $push: {
            notifies: notify
        },
        $inc: {
            newNotify: 1
        }
    }).then(_ => { return { message: 'success' }; });
};

var notify_reset = function(db, userId) {
    let userCol = db.collection('users');
    return userCol.updateOne({ _id: userId }, {
        $set: {
            newNotify: 0
        }
    }).then(_ => { return { message: 'success' }; });
};

var notify_remove = function(db, userId, notifyId) {
    let userCol = db.collection('users');
    return userCol.updateOne({ _id: userId }, {
        $pull: {
            notifies: {
                _id: new ObjectID(notifyId)
            }
        }
    }).then(_ => { return { message: 'success' }; });
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
        linesCol = db.collection('lines');

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

    let filesData = [];

    if (verbose)
        console.log('[project_add] files', projectId);

    for (let fileIndex = 0, fileLen = files.length; fileIndex < fileLen; fileIndex++) {
        let fileId = (projectId << 8) + fileIndex,
            file = files[fileIndex];

        if (verbose)
            console.log(' -', file);

        let lines = yield provider.getOriginalLines(file);
        let translines = yield provider.getTranslatedLines(file);
        let transCount = 0;
        // console.log(translines);

        let transData = [], linesData = [];

        for (let lineIndex = 0, lineLen = lines.length; lineIndex < lineLen; lineIndex++) {
            let text = lines[lineIndex];
            let transtext = translines[lineIndex];
            let lineId = (fileId << 12) + lineIndex;

            if (transtext === text) {
                transtext = null;
            } else {
                transCount++;
            }

            linesData.push({
                _id: lineId,
                text: text,
                transText: transtext,
                userId: null,
                time: transtext ? now : null,
                edited: transtext ? true : false,
                lock: false,
                sameGroup: null
            });

            let sames = sameTexts[text] ? sameTexts[text] : [];
            sames.push(lineId);
            if (transtext) {
                sames.lineId = lineId;
                sames.text = transtext;
            }
            sameTexts[text] = sames;
        }

        yield linesCol.insertMany(linesData);

        filesData.push({
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

    yield filesCol.insertMany(filesData);

    yield projectsCol.updateOne({
        _id: projectId
    }, {
        $set: {
            linesCount: projLinesCount,
            transCount: projTransCount,
        }
    });

    if (verbose)
        console.log('[project_add] sameGroup');

    let sameGroup = 0;
    for (let text in sameTexts) {
        let sames = sameTexts[text];
        if (sames.length > 1) {
            if (verbose)
                console.log(' - ', sameGroup, sames);

            let results = yield linesCol.updateMany( {
                $or: sames.map(id => { return {_id: id}; })
            }, {
                $set: {
                    sameGroup: sameGroup,
                    transText: sames.text,
                    time: now,
                }
            }, {
                multi: true,
            });

            // console.log(results);

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
    // console.log('[files_list]', projectName, fileName, options);
    return project_list(db, projectName).then((results) => {
        if (results.isBoom)
            return results;

        if (! results.length)
            return Boom.badRequest(`project '${projectName}' doesn't exist!`);

        // console.log('[files_list]', results);

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

        // console.log('[files_list] find');

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
            return Boom.badRequest(`project '${projectName}' doesn't exist!`);

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

var lines_list = function(db, projectName, fileName, lineIndex, options) {
    return files_list(db, projectName, fileName).then((results) => {
        // console.log('lines_list', results);

        if (results.isBoom)
            return results;

        if (! results.length)
            return Boom.badRequest(`file '${fileName}' doesn't exist!`);

        // if (results[0].lock) {
        //     return Boom.forbidden(`file '${results[0].name}' is locked!`);
        // }

        let fileId = results[0]._id;
        let lineId = (fileId << 12) | lineIndex;

        let linesCol = db.collection('lines');

        if (lineIndex !== undefined) {
            return linesCol.find({
                _id: lineId
            }).toArray();
        }

        fileId <<= 12;
        let page = options.page,
            per_page = options.per_page;

        if (options.per_page < 0) {
            return linesCol.find({
                _id: {
                    $gte: fileId,
                    $lt: fileId | 0xfff,
                }
            }).toArray();
        } else {
            let lineIdStart = page * per_page,
                lineIdEnd = lineIdStart + per_page;

            return linesCol.find({
                _id: {
                    $gte: fileId | lineIdStart,
                    $lt: fileId | lineIdEnd,
                }
            }).toArray();
        }
    });
};

// update tranline counter too
var lines_lock = async(function*(db, projectName, fileName, lineIndex, lock, userId) {
    let files = yield files_list(db, projectName, fileName);

    if (files.isBoom)
        return files;

    if (! files.length)
        return Boom.badRequest(`file '${fileName}' doesn't exist!`);

    let fileId = files[0]._id;
    let lineId = fileId << 12 | lineIndex;

    let linesCol = db.collection('lines');
    let lines = yield linesCol.find({ _id: lineId }).toArray();

    if (! lines.length)
        return Boom.badRequest(`line '${lineIndex}' doesn't exist!`);

    let line = lines[0];

    if (line.lock !== lock) {
        let filesCol = db.collection('files');
        let projectsCol = db.collection('projects');

        if (lock) {
            yield linesCol.updateOne({ _id: lineId }, {
                $set: {
                    lock: true,
                    userId: userId
                }
            });
            yield filesCol.updateOne({ _id: fileId }, {
                $inc: {
                    locksCount: 1
                }
            });
            yield projectsCol.updateOne({ _id: fileId }, {
                $inc: {
                    locksCount: 1
                }
            });
        } else {
            yield linesCol.updateOne({ _id: lineId }, {
                $set: {
                    lock: false,
                    userId: userId
                }
            });
            yield filesCol.updateOne({ _id: fileId }, {
                $inc: {
                    locksCount: -1
                }
            });
            yield projectsCol.updateOne({ _id: fileId }, {
                $inc: {
                    locksCount: -1
                }
            });
        }
        return {
            message: 'success',
            modifiedLine: line
        };
    } else {
        return {
            message: 'same'
        };
    }
});

var trans_add = async(function*(db, projectName, fileName, lineIndex, text, userId) {
    let projectsCol = db.collection('projects'),
        filesCol = db.collection('files'),
        linesCol = db.collection('lines'),
        transCol = db.collection('translines');

    let projects = yield projectsCol.find({name: projectName}).toArray();

    if (! projects.length)
        return Boom.badRequest(`project '${projectName}' doesn't exist!`);

    console.log('[trans_add] projects', projects[0]);

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

    if (! files.length)
        return Boom.badRequest(`file '${fileName}' doesn't exist!`);

    console.log('[trans_add] files', files[0]);

    if (files[0].lock)
        return Boom.forbidden(`file '${fileName}' is locked!`);

    let fileId = files[0]._id;
    let _lineId = fileId << 12 | lineIndex;

    let lines = yield linesCol.find({_id: _lineId}).toArray();

    if (! lines.length)
        return Boom.badRequest(`line '${lineIndex}' doesn't exist!`);

    console.log('[trans_add] lines', lines[0]);

    if (lines[0].lock)
        return Boom.forbidden(`line '${lineIndex}' is locked!`);


    // -------------------------------------------------------------------------

    let line = lines[0];
    let sameGroup = line.sameGroup;
    let now = new Date();

    if (line.transText === text) {
        return {
            message: 'same'
        };
    }

    // console.log('[trans_add] transText', text);

    if (sameGroup !== null) {
        console.log('[trans_add] sameGroup', sameGroup);

        yield linesCol.updateMany({
            sameGroup: sameGroup,
            edited: false
        }, {
            $set: {
                transText: text,
                userId: userId,
                time: now,
            }
        });
    }

    // console.log('[trans_add] lineId', _lineId);
    let results = yield linesCol.updateOne({
        _id: _lineId
    }, {
        $set: {
            transText: text,
            userId: userId,
            time: now,
            edited: true
        }
    });

    if (! line.edited) {
        yield filesCol.updateOne({
            _id: fileId
        }, {
            $inc: {
                'transCount': 1
            }
        });

        yield projectsCol.updateOne({
            _id: projectId
        }, {
            $inc: {
                'transCount': 1
            }
        });
    }

    return {
        message: 'success',
        modifiedLine: line
    };
});

// -----------------------------------------------------------------------------

var terms_list = function(db) {
    let termsCol = db.collection('terms');
    return termsCol.find().sort().toArray();
};

var terms_add = function(db, term, explanation, userId) {
    let termsCol = db.collection('terms');
    return termsCol.find({ term: term }).toArray().then(terms => {
        if (terms.length)
            return Boom.badRequest(`term '${term}' repeat!`);
        return termsCol.insertOne({
            term: term,
            explanation: explanation,
            userId: userId,
            time: new Date()
        }).then(result => {
            return {
                message: 'success'
            };
        });
    });
};

var terms_remove = function(db, termId) {
    let termsCol = db.collection('terms');
    return termsCol.deleteOne({
        _id: new ObjectID(termId),
    }).then(result => {
        return {
            message: 'success'
        };
    });
};

var terms_update = function(db, termId, explanation, userId) {
    let termsCol = db.collection('terms');
    return termsCol.updateOne({ _id: new ObjectID(termId) }, {
        $set: {
            explanation: explanation,
            userId: userId,
            time: new Date()
        }
    }).then(result => {
        return {
            message: 'success'
        };
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
exports.user_auth = user_auth;

exports.notify_add = notify_add;
exports.notify_reset = notify_reset;
exports.notify_remove = notify_remove;

exports.project_add = project_add;
exports.project_remove = project_remove;
exports.project_list = project_list;
// exports.project_lock = project_lock;

exports.files_list = files_list;
exports.files_lock = files_lock;

exports.lines_list = lines_list;
exports.trans_add = trans_add;
exports.lines_lock = lines_lock;
// exports.lines_add = lines_add;

exports.terms_list = terms_list;
exports.terms_add = terms_add;
exports.terms_remove = terms_remove;
exports.terms_update = terms_update;

exports.session_list = session_list;
exports.session_add = session_add;
exports.session_remove = session_remove;
exports.session_clean = session_clean;
