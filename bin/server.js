"use strict";

const bcrypt = require('bcryptjs');

const hapi = require('hapi');
const hapi_token = require('hapi-auth-bearer-token');
const hapi_inert = require('inert');
const hapi_good = require('good');
const Boom = require('boom');

const data = require('../lib/database.js');
const { async } = require('../lib/async.js');
const { newToken, checkToken, updateToken, deleteToken } = require('../lib/token.js');


const appName = 'hanz';

const server = new hapi.Server();
server.connection({ port: 3000 });

let DB = null;



server.register([
    hapi_inert,
    hapi_token, {
    register: hapi_good,
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

    server.auth.strategy('default', 'bearer-access-token', 'required', {
        allowQueryToken: true,
        allowMultipleHeaders: false,
        accessTokenName: 'token',
        validateFunc: function (token, callback) {
            console.log('validateFunc', token);
            // let request = this;
            callback(null, checkToken(token), {});
        }
    });

    server.route({
        method: 'GET',
        path: '/{p*}',
        handler: function(request, reply) {
            console.log('<404>');
            return reply.file('public/404.html');
        },
        config: {
            auth: false,
        }
    });

    server.route({
        method: 'GET',
        path: '/',
        handler: function(request, reply) {
            console.log('<root>', request.query);
            let token = request.query.token;
            if (! token)
                return reply.file('public/login.html');
            if (! checkToken(token))
                return reply.file('public/login.html');
            return reply.file('public/index.html');
        },
        config: {
            auth: false,
        }
    });

    server.route({
        method: 'GET',
        path: '/favicon.ico',
        handler: function(request, reply) {
            // console.log('assets', request.params);
            return reply.file('public/favicon.ico');
        },
        config: {
            auth: false,
        }
    });

    server.route({
        method: 'GET',
        path: '/views/{file*}',
        handler: function(request, reply) {
            return reply.file('public/' + request.params.file);
        },
        config: {
            auth: false,
        }
    });

    server.route({
        method: 'GET',
        path: '/assets/{file*}',
        handler: function(request, reply) {
            // console.log(encodeURIComponent(request.params.file));
            return reply.file('public/' + request.params.file);
        },
        config: {
            auth: false,
        }
    });

    // -------------------------------------------------------------------------
    // API
    // -------------------------------------------------------------------------

    server.route({
        method: 'GET',
        path: '/api/{p*}',
        handler: function(request, reply) {
            return reply({
                'documentation_url': {
                    'error': 'unknown api'
                }
            });
        },
        config: {
            auth: false,
        }
    });

    // Check name and password against the database and provide a token
    // if authentication successful
    server.route({
        method: 'GET',
        path: '/api/authenticate',
        handler: function(request, reply) {
            // console.log('api/authenticate', request.params);
            // console.log();
            console.log('api/authenticate', request.query);
            let username = request.query.username,
                password = request.query.password;
            reply(login(DB, username, password));
        },
        config: {
            auth: false,
        }
    });

    server.route({
        method: 'GET',
        path: '/api/project/{projectId?}',
        handler: function(request, reply) {
            // console.log('api/project', request.params);
            console.log('api/project', request.query);
            let projectId = parseInt(request.params.projectId);
            return reply(data.project_list(DB, isNaN(projectId) ? undefined : projectId));
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

var bcrypt_compare = function(data1, data2) {
    return new Promise((resolve, reject) => {
        // console.log('bcrypt_compare', data1,data2);
        bcrypt.compare(data1, data2, function(err, valid) {
            if (err)
                reject(err);
            else
                resolve(valid);
        });
    });
};

// 登录
var login = async(function*(db, user, password) {
    console.log('login', user, password);
    let userData = yield data.user_list(db, user).catch(err => { throw err; });
    // console.log('login userData', userData);
    if (! userData.length)
        return Boom.unauthorized('invalid username');
    let valid = yield bcrypt_compare(password, userData[0].password).catch(err => { throw err; });
    // console.log('login valid', valid);
    if (! valid)
        return Boom.unauthorized('invalid password');
    let token = newToken();
    console.log('login token', token);
    return {
        token: token
    };
});
