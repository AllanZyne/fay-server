"use strict";

const bcrypt = require('bcryptjs');
const hat = require('hat');

const hapi = require('hapi');
const hapi_cookie = require('hapi-auth-cookie');
// const hapi_monitor = require('hapijs-status-monitor');
const hapi_inert = require('inert');
const hapi_good = require('good');
const hapi_nes = require('nes');
const Boom = require('boom');

const database = require('../lib/database.js');
const { async } = require('../lib/async.js');
// const { newToken, checkToken, updateToken, deleteToken } = require('../lib/token.js');


const appName = 'hanz';

const server = new hapi.Server();
server.connection({ port: 3000 });

let DB = null;



server.register([ hapi_inert, hapi_cookie, hapi_nes, {
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

    const cache = server.cache({ segment: 'sessions', expiresIn: 5*24*60*60*1000 });
    server.app.cache = cache;

    server.auth.strategy('session', 'cookie', 'required', {
        password: 'A Robin Redbreast in a Cage, Puts all Heaven in a Rage.',
        cookie: 'sid',
        redirectTo: '/login',
        keepAlive: false,
        isSecure: false,
        validateFunc: function (request, session, callback) {
            cache.get(session.sid, (err, cached) => {
                if (err) {
                    return callback(err, false);
                }
                if (!cached) {
                    return callback(null, false);
                }
                return callback(null, true, cached.account);
            });
        }
    });

    // -------------------------------------------------------------------------

    server.route({
        method: 'GET',
        path: '/{p*}',
        handler: function(request, reply) {
            return reply.file('public/index.html');
        }
    });

    server.route({
        method: 'GET',
        path: '/login',
        handler: function(request, reply) {
            if (request.auth.isAuthenticated) {
                return reply.redirect('/');
            }
            return reply.file('public/login.html');
        },
        config: {
            auth: { mode: 'try' },
            plugins: {
                'hapi-auth-cookie': {
                    redirectTo: false
                }
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/404',
        handler: function(request, reply) {
            return reply.file('public/404.html');
        },
        config: {
            auth: false,
        }
    });

    // server.route({
    //     method: 'GET',
    //     path: '/{projectId}',
    //     handler: function(request, reply) {
    //     },
    //     config: {
    //         auth: false,
    //     }
    // });

    server.route({
        method: 'GET',
        path: '/settings',
        handler: function(request, reply) {
            return reply.file('public/404.html');
        }
    });

    server.route({
        method: 'GET',
        path: '/logout',
        handler: function(request, reply) {
            request.cookieAuth.clear();
            return reply.redirect('/login');
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
            let file = encodeURI(request.params.file);
            return reply.file('public/' + file);
        },
        // config: {
        //     auth: false,
        // }
    });

    server.route({
        method: 'GET',
        path: '/assets/{file*}',
        handler: function(request, reply) {
            // let file = encodeURI(request.params.file);
            let file = request.params.file;
            return reply.file('public/' + file);
        },
        config: {
            auth: false,
        }
    });

    // -------------------------------------------------------------------------
    // APIs
    // -------------------------------------------------------------------------

    server.route({
        method: 'GET',
        path: '/api/{p*}',
        handler: function(request, reply) {
            return reply({
                'error': 'unknown api request',
                'documentation_url': {
                    '/api/authenticate': '',
                    '/api/project/{projectId?}': '',
                    '/api/project/{projectId}/file/{fileId?}': '',
                    '/api/project/{projectId}/file/{fileId}/line/{lineId?}': '',
                }
            });
        },
        config: {
            auth: false,
        }
    });

    server.route({
        method: 'GET',
        path: '/api/authenticate',
        handler: authenticate,
        config: {
            auth: false,
        }
    });

    server.route({
        method: 'GET',
        path: '/api/project/{projectId?}',
        handler: function(request, reply) {
            let projectId = decodeURI(request.params.projectId),
                options = request.query;

            console.log('[credentials]', request.auth.credentials);

            database.project_list(DB, projectId, options).then(
                result => reply(result),
                err    => reply(Boom.wrap(err))
            );
        }
    });

    server.route({
        method: 'GET',
        path: '/api/project/{projectId}/file/{fileId?}',
        handler: function(request, reply) {
            let projectId = decodeURI(request.params.projectId),
                fileId = decodeURI(request.params.fileId),
                options = request.query;

            database.files_list(DB, projectId, fileId, options).then(
                result => reply(result),
                err    => reply(Boom.wrap(err))
            );
        }
    });

    server.route({
        method: 'GET',
        path: '/api/project/{projectId}/file/{fileId}/line/{lineId?}',
        handler: function(request, reply) {
            let projectId = decodeURI(request.params.projectId),
                fileId = decodeURI(request.params.fileId),
                lineId = decodeURI(request.params.lineId),
                options = request.query;

            lineId = checkLineId(lineId);
            if (lineId && lineId.isBoom)
                return reply(lineId);

            options = checkLineOptions(options);
            if (options.isBoom)
                return reply(options);

            database.lines_list(DB, projectId, fileId, lineId, options).then(
                result => reply(result),
                err    => reply(Boom.wrap(err))
            );
        }
    });

    server.route({
        method: 'GET',
        path: '/api/project/{projectId}/file/{fileId}/transline/{lineId?}',
        handler: function(request, reply) {
            let projectId = decodeURI(request.params.projectId),
                fileId = decodeURI(request.params.fileId),
                lineId = decodeURI(request.params.lineId),
                options = request.query;

            lineId = checkLineId(lineId);
            if (lineId && lineId.isBoom)
                return reply(lineId);

            options = checkLineOptions(options);
            if (options.isBoom)
                return reply(options);

            database.trans_list(DB, projectId, fileId, lineId, options).then(
                result => reply(result),
                err    => reply(Boom.wrap(err))
            );
        }
    });

    server.route({
        method: 'POST',
        path: '/api/project/{projectId}/file/{fileId}/transline/{lineId?}',
        handler: function(request, reply) {
            let user = request.auth.credentials;
            if (user.type > 1) {
                return reply(Boom.illegal("your account is not permitted to commit"));
            }

            let projectId = decodeURI(request.params.projectId),
                fileId = decodeURI(request.params.fileId),
                lineId = decodeURI(request.params.lineId);

            console.log('/api/transline', request.params);

            lineId = checkLineId(lineId);
            if (typeof lineId !== 'number')
                return reply(Boom.badRequest("lineId is wrong"));

            // XXXX: 检查是否有恶意代码！！
            let text = request.payload;
            if (typeof text !== 'string')
                return reply(Boom.badRequest("payload data format is wrong"));
            console.log('/api/transline', text);

            return reply(database.trans_add(DB, projectId, fileId, lineId, text, user._id));
        }
    });

    database.connect('hanz').then((db) => {
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

// -----------------------------------------------------------------------------
// Help Functions
// -----------------------------------------------------------------------------

function encodeURI(uri) {
    if (uri)
        return encodeURIComponent(uri);
}

function decodeURI(uri) {
    if (uri)
        return decodeURIComponent(uri);
}

function bcrypt_compare(data1, data2) {
    return new Promise((resolve, reject) => {
        // console.log('bcrypt_compare', data1,data2);
        bcrypt.compare(data1, data2, function(err, valid) {
            if (err)
                reject(err);
            else
                resolve(valid);
        });
    });
}

function authenticate(request, reply) {
    console.log('[authenticate]');
    let username = decodeURI(request.query.username),
        password = decodeURI(request.query.password);
    database.user_list(DB, username).then(users => {
        console.log('[authenticate]', users);
        if (! users.length)
            return reply(Boom.unauthorized('invalid username'));
        return bcrypt_compare(password, users[0].password).then(valid => {
            console.log('[authenticate] valid');
            if (! valid)
                return reply(Boom.unauthorized('invalid password'));
            const sid = hat();
            request.server.app.cache.set(sid, { account: users[0] }, 0, (err) => {
                if (err) {
                    return reply(Boom.wrap(err));
                }
                console.log('[authenticate] redirect');
                request.cookieAuth.set({ sid: sid });
                return reply.redirect('/');
            });
        });
    }).catch(err => {
        reply(Boom.wrap(err));
    });
}

function checkLineId(lineId) {
    if (! lineId)
        return;

    lineId = parseInt(lineId);
    if (isNaN(lineId))
        return Boom.badRequest(`'lineId' is invalid`);
    if (lineId < 0)
        return Boom.badRequest(`'lineId' is invalid`);
    if (lineId > 0xfff)
        return Boom.badRequest(`'lineId' is invalid`);
    return lineId;
}

function checkLineOptions(options) {
    let page = 0;
    if (options.page) {
        page = parseInt(options.page);
        if (isNaN(page))
            return Boom.badRequest(`'page' is invalid`);
        if (page < 0)
            return Boom.badRequest(`'page' is invalid`);
    }
    options.page = page;

    let per_page = 30;
    if (options.per_page) {
        per_page = parseInt(options.per_page);
        if (isNaN(per_page))
            return Boom.badRequest(`'per_page' is invalid`);
    }
    options.per_page = per_page;

    return options;
}
