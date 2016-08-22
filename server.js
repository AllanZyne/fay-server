"use strict";

const hapi = require('hapi');
const hat = require('hat');

const data = require('./lib/data.js');


const appName = 'hanz';

const server = new hapi.Server();
server.connection({ port: 3000 });


server.state(`${appName}-data`, {
    ttl: null,
    isSecure: true,
    isHttpOnly: true,
    encoding: 'base64json',
    clearInvalid: false, // remove invalid cookies
    strictHeader: true // don't allow violations of RFC 6265
});

server.register([
    require('inert'), {
    register: require('good'),
    options: {
        reporters: {
            console: [{
                module: 'good-squeeze',
                name: 'Squeeze',
                args: [{
                    response: '*',
                    log: '*'
                }]
            }, {
                module: 'good-console'
            }, 'stdout']
        }
    }
}], (err) => {
    if (err) {
        throw err; // something bad happened loading the plugin
    }

    let DB = null;

    // 登陆界面 || 项目列表
    server.route({
        method: 'GET',
        path: '/{p*}',
        handler: function(request, reply) {
            console.log('<root>', request.state);
            console.log('<root>', request.query);
            // if (request.state.token) {
            //     return reply.file('public/index.html');
            // } else {
            //     return reply.file('public/login.html');
            // }
            return reply.file('public/index.html');
        },
        // config: {
        //     state: {
        //         parse: true,        // parse and store in request.state
        //         failAction: 'error' // may also be 'ignore' or 'log'
        //     }
        // }
    });

    server.route({
        method: 'GET',
        path: '/favicon.ico',
        handler: function(request, reply) {
            // console.log('assets', request.params);
            return reply.file('public/favicon.ico');
        }
    });

    server.route({
        method: 'GET',
        path: '/views/{file*}',
        handler: function(request, reply) {
            return reply.file('public/' + request.params.file);
        },
    });

    server.route({
        method: 'GET',
        path: '/assets/{file*}',
        handler: function(request, reply) {
            // console.log(encodeURIComponent(request.params.file));
            return reply.file('public/' + request.params.file);
        }
    });

    // -------------------------------------------------------------------------
    // API
    // -------------------------------------------------------------------------

    server.route({
        method: 'GET',
        path: '/api',
        handler: function(request, reply) {
            // console.log('api', request.params);
            return reply({
                'documentation_url': null
            });
        }
    });

    // Check name and password against the database and provide a token
    // if authentication successful
    server.route({
        method: 'GET',
        path: '/api/authenticate',
        handler: function(request, reply) {
            console.log('api', request.params);
            console.log('api', request.query);
            return reply({ token: hat() });
        }
    });

    server.route({
        method: 'GET',
        path: '/api/project/{projectId?}',
        handler: function(request, reply) {
            // console.log('api/project', request.params);
            // console.log('api/project', request.query);
            let projectId = parseInt(request.params.projectId);

            if (isNaN(projectId)) {
                reply(data.project_list(DB));
            } else {
                reply(data.project_list(DB, projectId));
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/api/project/{projectId}/file/{fileId?}',
        handler: function(request, reply) {
            // console.log('api', request.params);
            // console.log('api', request.query);
            let projectId = parseInt(request.params.projectId),
                fileId = parseInt(request.params.fileId);

            if (isNaN(projectId))
                return reply('api');
            else if (isNaN(fileId))
                return reply(data.files_list(DB, projectId));
            else
                return reply(data.files_list(DB, projectId, fileId));
        }
    });

    server.route({
        method: 'GET',
        path: '/api/project/{projectId}/file/{fileId}/line/{lineId?}',
        handler: function(request, reply) {
            // console.log('api', request.params);
            let projectId = parseInt(request.params.projectId),
                fileId = parseInt(request.params.fileId),
                lineId = parseInt(request.params.lineId);
            if (isNaN(projectId) || isNaN(fileId))
                return reply('api');
            else if (isNaN(lineId))
                return reply(data.lines_list(DB, projectId, fileId));
            else
                return reply(data.lines_list(DB, projectId, fileId, lineId));
        }
    });

    server.route({
        method: 'GET',
        path: '/api/project/{projectId}/file/{fileId}/line/{lineId}/translines',
        handler: function(request, reply) {
            // console.log('api', request.params);
            let projectId = parseInt(request.params.projectId),
                fileId = parseInt(request.params.fileId),
                lineId = parseInt(request.params.lineId);
            if (isNaN(projectId) || isNaN(fileId) || isNaN(lineId))
                return reply('api');
            else
                return reply(data.trans_list(DB, projectId, fileId, lineId));
        }
    });

    data.connect('hanz').then((db) => {
        DB = db;
        server.log('info', 'mongodb connected');

        server.start((err) => {
            if (err) {
                throw err;
            }
            server.log('info', 'Server running at: ' + server.info.uri);
        });
    }).catch((err) => {
        server.log('error', "mongodb can't connected !!");
    });

});

// 登录

// 文件的语句列表（内容，状态）

// 编辑语句（原句，新句）

// let server = http.createServer();

// server.listen(8080);

// server.on('request', function(request, response) {
//     let headers = request.headers;
//     let method = request.method;
//     let url = path.normalize(request.url);

//     // console.log('headers', headers);
//     console.log('method', method);
//     console.log('url', url);

//     let body = [];
//     request.on('error', function(err) {
//         console.error(err);
//     }).on('data', function(chunk) {
//         body.push(chunk);
//     }).on('end', function() {
//         body = Buffer.concat(body).toString();

//         if (url.match(/^\/((css|js)\/.+)?$/g))
//             staticFiles(url, response);
//         else if (url == '/login') {
//             login();
//         }
//     });
// });

// server.on('error', function(err) {
//   // This prints the error message and stack trace to `stderr`.
//   console.error(err.stack);
// });

// function login(request, response) {
//     let name = request.name;
//     fs.readFile('data/users.json', (err, data) => {
//         if (err)
//             throw err;
//         let users = JSON.parse(data.toString());
//         let findUser = null;
//         for (let user of users) {
//             if (user.name == name) {
//                 findUser = user;
//                 break;
//             }
//         }
//         if (findUser) {

//         } else {

//         }
//     });
// }

// // 项目的文件列表（文件名；汉化完成度；状态（锁定、编辑、审核））
// function hanzFileList() {
//     let files = fs.readdir('proj/AiryFairy');

// }

// // 汉化文件（语句id；原句；翻译）
// function hanzLineList() {

// }

// function staticFiles(url, response) {
//     var filePath = url.slice(1);
//     if (! filePath.length)
//         filePath = 'client.html';
//     console.log('static files', filePath);
//     var readable = fs.createReadStream(filePath);
//     readable.pipe(response);
// }
