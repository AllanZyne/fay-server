const http = require('http');
const querystring = require('querystring');
const crypto = require('crypto');

const Boom = require('boom');


let appid = '20160708000024870';
let key = '2veGZCthLCu7exLViP9K';

function MD5(data) {
    const hash = crypto.createHash('md5');
    hash.update(data);
    return hash.digest('hex');
}

module.exports = function(postData) {
    let query = postData.q;
    if (! query)
        return Boom.badRequest(`query is empty`);

    let salt = (new Date()).getTime();
    let sign = MD5(appid + query + salt + key);

    postData.appid = appid;
    postData.salt = salt;
    postData.sign = sign;

    // console.log('postData', postData);

    postData = querystring.stringify(postData);

    return new Promise((resolve, reject) => {
        let options = {
            hostname: 'api.fanyi.baidu.com',
            port: 80,
            path: '/api/trans/vip/translate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        let req = http.request(options, (res) => {
            // console.log(`STATUS: ${res.statusCode}`);
            // console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
            let buffer = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                buffer += chunk;
            });
            res.on('end', () => {
                resolve(JSON.parse(buffer));
            });
        });

        req.on('error', (err) => {
            // console.log(`problem with request: ${err.message}`);
            reject(err);
        });

        req.write(postData);
        req.end();
    });
};
