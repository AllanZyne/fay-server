"use strict";

const bcrypt = require('bcryptjs');
const hat = require('hat');

const hapi = require('hapi');
const hapi_cookie = require('hapi-auth-cookie');
// const hapi_monitor = require('hapijs-status-monitor');
const hapi_inert = require('inert');
const hapi_good = require('good');
// const hapi_nes = require('nes');
const Boom = require('boom');

const database = require('../lib/database.js');
const { async } = require('../lib/async.js');
const config = require('../lib/config.js');
// const { newToken, checkToken, updateToken, deleteToken } = require('../lib/token.js');


const appName = 'fay0n';

const server = new hapi.Server();
server.connection({ port: 3000 });

let DB = null;


server.register([
    hapi_inert,
    hapi_cookie,
    // hapi_nes,
{
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

    // something bad happened loading the plugin
    if (err) {
        throw err;
    }

    const cache = server.cache({ segment: 'sessions', expiresIn: 5*24*60*60*1000 });
    server.app.cache = cache;

    server.auth.strategy('session', 'cookie', 'required', {
        password: config.secret,
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
    // ACTIONs
    // -------------------------------------------------------------------------



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

    // -------------------------------------------------------------------------

    server.route({
        method: 'GET',
        path: '/api/login',
        handler: authenticate,
        config: {
            auth: false,
        }
    });

    // new user
    // server.route({
    //     method: 'POST',
    //     path: '/api/register',
    //     handler: function(request, reply) {
    //         let payload = request.payload;

    //         if (! payload)
    //             return reply(Boom.badRequest(`payload is missing`));

    //         if (! payload.username)
    //             return reply(Boom.badRequest(`username is missing`));
    //         if (! payload.password)
    //             return reply(Boom.badRequest(`password is missing`));

    //         let username = payload.username.toString(),
    //             password = payload.password.toString();

    //         return reply(database.user_add(DB, username, password, 1));
    //     }
    // });

    // -------------------------------------------------------------------------

    // get user data
    server.route({
        method: 'GET',
        path: '/api/user/{userId?}',
        handler: function(request, reply) {
            let user = request.auth.credentials;
            if (user.type > 1) {
                return reply(Boom.illegal("your account is not permitted to commit"));
            }
            let userId = user._id;

            return reply(database.user_list(DB, userId));
        }
    });

    // update user data
    server.route({
        method: 'PUT',
        path: '/api/user',
        handler: function(request, reply) {
            let user = request.auth.credentials;
            if (user.type > 1) {
                return reply(Boom.illegal("your account is not permitted to commit"));
            }
            let userId = user._id;

            let options = {};

            if (request.payload === undefined)
                return reply(Boom.badRequest(`payload is empty`));

            options.password = request.payload.password;
            options.email = request.payload.email;
            // options._id = request.payload.username;

            return reply(database.user_update(DB, userId, options));
        }
    });

    // -------------------------------------------------------------------------

    // // get nofity
    // server.route({
    //     method: 'GET',
    //     path: '/api/notify/{userId}',
    //     handler: function(request, reply) {

    //     }
    // });

    // delete nofify
    server.route({
        method: 'DELETE',
        path: '/api/notify',
        handler: function(request, reply) {
            let user = request.auth.credentials;
            let userId = user._id;

            let notifyId = request.query.notifyId;
            if (! notifyId)
                return reply(Boom.badRequest(`notifyId is missing`));
            return reply(database.notify_remove(DB, userId, notifyId));
        }
    });

    // clear notify
    server.route({
        method: 'PUT',
        path: '/api/notify',
        handler: function(request, reply) {
            let user = request.auth.credentials;
            if (user.type > 1) {
                return reply(Boom.illegal("your account is not permitted to commit"));
            }
            let userId = user._id;

            return reply(database.notify_reset(DB, userId));
        }
    });

    // -------------------------------------------------------------------------

    server.route({
        method: 'GET',
        path: '/api/terms',
        handler: function(request, reply) {
            return reply(database.terms_list(DB));
        }
    });

    server.route({
        method: 'POST',
        path: '/api/terms',
        handler: function(request, reply) {
            let user = request.auth.credentials;
            if (user.type > 1) {
                return reply(Boom.illegal("your account is not permitted to commit"));
            }
            let userId = user._id;

            let payload;
            try {
                payload = JSON.parse(request.payload);
            } catch (err) {
                return reply(Boom.wrap(err));
            }

            let term = payload.term, explanation = payload.explanation;
            if (! term)
                return reply(Boom.badRequest('"term" is empty'));
            if (! explanation)
                return reply(Boom.badRequest('"explanation" is empty'));

            term = term.replace(/</g, '&lt;');
            explanation = explanation.replace(/</g, '&lt;');

            return reply(database.terms_add(DB, term, explanation, userId));
        }
    });

    server.route({
        method: 'PUT',
        path: '/api/terms',
        handler: function(request, reply) {
            let user = request.auth.credentials;
            if (user.type > 1) {
                return reply(Boom.illegal("your account is not permitted to commit"));
            }
            let userId = user._id;

            let payload;
            try {
                payload = JSON.parse(request.payload);
            } catch (err) {
                return reply(Boom.wrap(err));
            }

            let termId = payload.termId, explanation = payload.explanation;
            if (! termId)
                return reply(Boom.badRequest('"termId" is empty'));
            if (! explanation)
                return reply(Boom.badRequest('"explanation" is empty'));
            explanation = explanation.replace(/</g, '&lt;');

            // TODO: notify
            return reply(database.terms_update(DB, termId, explanation, userId));
        }
    });

    server.route({
        method: 'DELETE',
        path: '/api/terms',
        handler: function(request, reply) {
            let user = request.auth.credentials;
            if (user.type > 1) {
                return reply(Boom.illegal("your account is not permitted to commit"));
            }
            let userId = user._id;

            // TODO: notify
            let termId = request.query.termId;
            return reply(database.terms_remove(DB, termId));
        }
    });

    // -------------------------------------------------------------------------

    server.route({
        method: 'GET',
        path: '/api/project/{projectId?}',
        handler: function(request, reply) {
            let projectId = decodeURI(request.params.projectId),
                options = request.query;
            // console.log('[credentials]', request.auth.credentials);
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

    // server.route({
    //     method: 'GET',
    //     path: '/api/project/{projectId}/file/{fileId}/transline/{lineId?}',
    //     handler: function(request, reply) {
    //         let projectId = decodeURI(request.params.projectId),
    //             fileId = decodeURI(request.params.fileId),
    //             lineId = decodeURI(request.params.lineId),
    //             options = request.query;

    //         lineId = checkLineId(lineId);
    //         if (lineId && lineId.isBoom)
    //             return reply(lineId);

    //         options = checkLineOptions(options);
    //         if (options.isBoom)
    //             return reply(options);

    //         database.trans_list(DB, projectId, fileId, lineId, options).then(
    //             result => reply(result),
    //             err    => reply(Boom.wrap(err))
    //         );
    //     }
    // });

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

            // console.log('/api/transline', request.params);

            lineId = checkLineId(lineId);
            if (typeof lineId !== 'number')
                return reply(Boom.badRequest("lineId is wrong"));

            // XXXX: 检查是否有恶意代码！！
            let text = request.payload;
            if (typeof text !== 'string')
                return reply(Boom.badRequest("payload data format is wrong"));
            text = text.replace(/</g, '&lt;');
            // console.log('/api/transline', text);

            return reply(database.trans_add(DB, projectId, fileId, lineId, text, user._id));
        }
    });

    database.connect().then((db) => {
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
    let username = decodeURI(request.query.username),
        password = decodeURI(request.query.password);
    console.log('[authenticate]', username);
    database.user_auth(DB, username).then(user => {
        console.log('[authenticate]', user);
        bcrypt_compare(password, user.password).then(valid => {
            console.log('[authenticate] valid');
            if (! valid)
                return reply(Boom.unauthorized('invalid password'));
            const sid = hat();
            request.server.app.cache.set(sid, { account: user }, 0, (err) => {
                if (err)
                    return reply(err);
                request.cookieAuth.set({ sid: sid });

                console.log('[authenticate] success');
                return reply({
                    message: 'success'
                });
            });
        }).catch(err => {
            reply(err);
        });
    }).catch(err => {
        return reply(Boom.unauthorized('invalid username'));
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
