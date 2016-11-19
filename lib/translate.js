const http = require('http');
const querystring = require('querystring');
const url = require('url');
const crypto = require('crypto');
// const request = require('request');

const Boom = require('boom');


function baidufanyi(postQuery) {
    const appid = '20160708000024870';
    const key = '2veGZCthLCu7exLViP9K';

    let query = postQuery.q;
    let salt = (new Date()).getTime();
    let sign = MD5(appid + query + salt + key);

    postQuery.appid = appid;
    postQuery.salt = salt;
    postQuery.sign = sign;

    return htmlPost('http://api.fanyi.baidu.com/api/trans/vip/translate', postQuery)
        .then(result => {
            // console.log('baidu', result);
            if (! result.trans_result)
                return {
                    'source': 'baidu',
                    'error': result
                };
            else {
                return {
                    'source': 'baidu',
                    'result': result.trans_result.map(data => data.dst)
                };
            }
        });
}

function vnrSuggest(postQuery) {
    let form = {
        app: 'web',
        domain: 'game',
        fr: 'ja',
        // limit: 10,
        // opt: 'mrdsS',
        q: postQuery.q,
        // sl: 3,
        to: 'zh-CN',
        // version: 1460931703,
    }

    return htmlPost('http://www.tranzz.com/api/translate', form).then(result => {
        // console.log('vnr', result);
        if (result.error)
            return {
                'source': 'vnr',
                'error': result
            };
        else
            return {
                'source': 'vnr',
                'result': [result.data.t]
            };
    });
}

function htmlPost(uri, form) {
    return new Promise((resolve, reject) => {
        let urlObject = url.parse(uri);
        let content = querystring.stringify(form);
        let options = {
            hostname: urlObject.hostname,
            port: urlObject.port || 80,
            path: urlObject.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(content)
            }
        };

        let req = http.request(options, (res) => {
            let buffer = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                buffer += chunk;
            });
            res.on('end', () => {
                // console.log(JSON.parse(buffer));
                resolve(JSON.parse(buffer));
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(content);
        req.end();
    });
}

function MD5(data) {
    const hash = crypto.createHash('md5');
    hash.update(data);
    return hash.digest('hex');
}


module.exports = function(postQuery) {
    if (! postQuery.q) {
        return Boom.badRequest(`query is empty`);
    }
    return Promise.all([vnrSuggest(postQuery), baidufanyi(postQuery)]);
};
