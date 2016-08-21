"use strict";

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const { async, access } = require('./async.js');

let argv = process.argv.slice(2);
let cmd = argv[0] ? argv[0].split('-') : [];
let cmdArgs = argv.slice(1);

let { MongoClient, ObjectID } = require('mongodb');

function connect(name) {
    return MongoClient.connect(`mongodb://localhost:27017/${name}`);
}

/*

用户管理

user-add NAME PASSWORD TYPE
TYPE:
   0: ????
   1: WRITE   翻译
   2: READ   读者
user-remove NAME
user-edit NAME [-p PASSWORD] [-t TYPE]
user-list [-v] [NAME]

*/


let user_add = async(function*(db, name, password, type) {
    let userdb = db.collection('users');
    // console.log(name);
    let result = yield userdb.find({ name: name }).limit(1).toArray();
    // console.log(result);
    if (result.length)
        throw new Error('用户名重复：' + name);

    let typeno = parseInt(type);
    if (typeno < 0 || typeno > 2)
        throw new Error('未定义权限：' + type);

    password = hashPassword(password);

    return yield userdb.insertOne({
        name: name,
        password: password,
        type: typeno
    });
    // console.log('insert');
});

let user_delete = async(function*(db, name) {
    let userdb = db.collection('users');
    return yield userdb.deleteOne({ name: name });
});

let user_update = async(function*(db, name, options) {
    let userdb = db.collection('users');
    let { password, type } = options;

    if (password || type) {
        let doc = {};
        if (password)
            doc.password = hashPassword(password);
        if (type)
            doc.type = type;
        yield userdb.update({ name: name }, doc);
    }
});

let user_list = async(function*(db) {
    let userdb = db.collection('users');
    return yield userdb.find().toArray();
});

// let testdb = async(function*() {
//     let db = yield MongoClient.connectAsync('mongodb://localhost:27017/user');
//     console.log('connect!!');

//     yield user_add(db, "1212", "1212", 1).catch((err) => {

//     });
//     console.log('user_list');
//     let list = yield user_list(db);
//     console.log(list);
//     console.log('user_delete');
//     yield user_delete(db, '1212');
//     db.close();
// });

function hashPassword(data) {
    let h = crypto.createHash('hashPassword');
    h.update(data);
    return h.digest('hex').substr(0, 16).toUpperCase();
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


let user = async(function*() {
    let db = yield connect('system');
    // let userdb = db.collection("users");

    if (cmd[1] == 'add') {
        let [name, password, type] = cmdArgs;
        if (! (name && password && type))
            help();
            yield user_add(db, name, password, type);
    } else if (cmd[1] == 'remove') {
        let [ name ] = cmdArgs;
        if (! name)
            help();
        yield user_delete(db, name);
    } else if (cmd[1] == 'list') {

    }

    db.close();
});


// 项目管理
//
// proj-add name PATH
// proj-remove name
// proj-update name
// proj-list name
//

class Connect {
    constructor() {

    }

}

class Project extends Connect {
    constructor(name) {
        this.name = name;
        if (name == 'system')
            throw new Error();
    }

    connect() {
        return Promise.all([connect('system'), connect(this.name)])
            .then(dbs => {
                let [ systemdb, projectdb ] = dbs;
                this.systemdb = systemdb;
                this.projectdb = projectdb;
                this.filesdb = projectdb.collection('files');
                // this.linesdb = projectdb.collection('lines');
                this.translinesdb = projectdb.collection('translines');
            })
            .catch(err => console.log(err));
    }

    close() {
        if (this.db)
            this.db.close();
        if (this.projectdb)
            this.projectdb.close();
    }

    setProvider(provider) {
        return setProvider(this.systemdb, this.projectdb, this.name, provider);
    }

    listFiles() {
        return this.filesdb.find().toArray();
    }

    listLines(file) {
        return listLines(this.projectdb, file);
        // return this.linesdb.find({ file: file }).sort('line').toArray();
    }

    addTranslateLine(file, line, text,user) {
        this.translinesdb.insertOne({
            file: file,
            line: line,
            text: text,
            user: user,
            time: new Date(),
        });
    }
}

// 0000 0001 082b 3df0 26ec 0001
// function genLineId(line) {
//     let hexString = ('000000000000000000000000' + line.toString(16)).slice(-24);
//     return ObjectID.createFromHexString(hexString);
// }

// function genStringId(str) {
//     return ObjectID.createFromHexString('0000000000000000' + crc32(str));
// }

// function getFileLineId(file, line) {
//     let fileHash = crc32(file);
//     let hexString = '00000000' + fileHash + ('00000000' + line.toString(16)).slice(-8);
//     return ObjectID.createFromHexString(hexString);
// }


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

// var listLines = async(function*(projectdb, file) {
//     // let coltext = projectdb.collection(`text|${file}`),
//     //     coltrans = projectdb.collection(`trans|${file}`);

// });


// let project_update = async(function*() {

// });

let project_list = async(function*(db) {
    console.log('!!!');
    let projectsCol = db.collection('projects');
    return projectsCol.find({}).sort({ _id: 1 }).toArray();
});

let files_list = async(function*(db, projectId) {
    let filesCol = db.collection('files');
    projectId <<= 8;
    return filesCol.find({
        _id: {
            $gte: projectId,
            $lte: projectId | 0xff,
        }
    }).sort({ _id: 1 }).toArray();
});

let lines_list = async(function*(db, fileId) {
    let linesCol = db.collection('lines');
    fileId <<= 12;

    // return linesCol.find({
    //     _id: {
    //              $gte: fileId,
    //              $lte: fileId | 0xfff,
    //     },
    //     transId: {
    //         $ne: null
    //     }
    // }).toArray();

    return linesCol.aggregate([{
        $match: {
            _id: {
                 $gte: fileId,
                 $lte: fileId | 0xfff,
            },
            // transId: {
            //     $ne: null
            // }
        }
    }, {
        $lookup: {
            from: 'translines',
            localField: 'transId',
            foreignField: '_id',
            as: 'transline',
        }
    }], {
        cursor: { batchSize: 1 }
    }).toArray();
});

let trans_list = async(function*(db, lineId) {
    let translinesCol = db.collection('translines');
    lineId <<= 4;
    return translinesCol.find({
        _id: {
            $gte: lineId,
            $lte: lineId | 0xf,
        }
    }).toArray();
});

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

async(function*testproj() {
    let db = yield connect('hanz');
    let provider = require('D:/Workspace/_html/hanz/projects/AiryFairy/_.js');
    console.log('test');
    // yield setProvider(db, provider);
    // console.log('provided!!');

    // console.log(yield project_list(db));
    // console.log(yield files_list(db, 0));
    // console.log(yield lines_list(db, 0x1));
    console.log(yield trans_list(db, 57371));
})().then(() => {
    process.exit();
});

return;

function proj(dir) {
    let script = path.join(dir, '_.js');

}







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
        console.log('Help:', cmd[0]);
    }

    process.exit(-1);
}

function error(message) {
    console.error(message);
    process.exit(1);
}


if (cmd[0] == 'user')
    user();
else if (cmd[0] == 'proj')
    proj();
else
    help();
