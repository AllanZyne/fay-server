// 登录

// 文件的语句列表（内容，状态）

// 编辑语句（原句，新句）

const http = require('http');
const fs = require('fs');
const path = require('path');

let server = http.createServer();

server.listen(8080);

server.on('request', function(request, response) {
    let headers = request.headers;
    let method = request.method;
    let url = path.normalize(request.url);

    // console.log('headers', headers);
    console.log('method', method);
    console.log('url', url);

    let body = [];
    request.on('error', function(err) {
        console.error(err);
    }).on('data', function(chunk) {
        body.push(chunk);
    }).on('end', function() {
        body = Buffer.concat(body).toString();

        if (url.match(/^\/((css|js)\/.+)?$/g))
            staticFiles(url, response);
        else if (url == '/login') {
            login();
        }
    });
});

server.on('error', function(err) {
  // This prints the error message and stack trace to `stderr`.
  console.error(err.stack);
});

function login(request, response) {
    let name = request.name;
    fs.readFile('data/users.json', (err, data) => {
        if (err)
            throw err;
        let users = JSON.parse(data.toString());
        let findUser = null;
        for (let user of users) {
            if (user.name == name) {
                findUser = user;
                break;
            }
        }
        if (findUser) {

        } else {

        }
    });
}

// 项目的文件列表（文件名；汉化完成度；状态（锁定、编辑、审核））
function hanzFileList() {
    let files = fs.readdir('proj/AiryFairy');

}

// 汉化文件（语句id；原句；翻译）
function hanzLineList() {

}

function staticFiles(url, response) {
    var filePath = url.slice(1);
    if (! filePath.length)
        filePath = 'client.html';
    console.log('static files', filePath);
    var readable = fs.createReadStream(filePath);
    readable.pipe(response);
}
