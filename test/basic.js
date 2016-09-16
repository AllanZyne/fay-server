const Bcrypt = require('bcryptjs');

const users = {
    john: {
        username: 'john',
        password: '$2a$10$iqJSHD.BGr0E2IxQwYgJmeP3NvhPrXAeLSaGCj6IR/XU5QtjVu5Tm',   // 'secret'
        name: 'John Doe',
        id: '2133d32a'
    }
};

const validate = function (request, username, password, callback) {

    const user = users[username];
    if (!user) {
        return callback(null, false);
    }

    Bcrypt.compare(password, user.password, (err, isValid) => {

        callback(err, isValid, { id: user.id, name: user.name });
    });
};


const hapi = require('hapi');
const server = new hapi.Server();
server.connection({ port: 8000 });

server.register(require('hapi-auth-basic'), (err) => {

    server.auth.strategy('simple', 'basic', { validateFunc: validate });
    server.route({
        method: 'GET',
        path: '/',
        handler: (request, reply) => reply('hello'),
        config: { auth: 'simple' }
    });

    server.start((err) => {
        if (err) {
            throw err;
        }
        server.log('info', 'Server running at: ' + server.info.uri);
    });
});