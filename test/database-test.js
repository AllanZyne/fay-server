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


async(function*testproj() {
    console.log('test!!!');

    let db = yield connect('hanz');
    console.log('connect!!');

    let provider = require('D:/Workspace/_html/hanz/projects/AiryFairy/_.js');
    // console.log('test');
    yield setProvider(db, provider);
    console.log('provided!!');

    // console.log(yield project_list(db));
    // console.log(yield files_list(db, 0));
    // console.log(yield lines_list(db, 0x1));
    // console.log(yield trans_list(db, 57371));
})().then(() => {
    process.exit();
}).catch(err => console.log(err));