const http = require('http');
const querystring = require('querystring');
const crypto = require('crypto');


function MD5(data) {
    const hash = crypto.createHash('md5');
    hash.update(data);
    return hash.digest('hex');
}


var postData = querystring.stringify({
  q: '火曜の夜',
  from: 'jp',
  to: 'zh',
  appid: 20160708000024870,
  salt: 1435660288,
  sign: MD5('20160708000024870' + '火曜の夜' + '1435660288' + '2veGZCthLCu7exLViP9K')
});

var options = {
  hostname: 'api.fanyi.baidu.com',
  port: 80,
  path: '/api/trans/vip/translate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

var req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
  res.on('end', () => {
    console.log('No more data in response.')
  })
});

req.on('error', (e) => {
  console.log(`problem with request: ${e.message}`);
});

// write data to request body
req.write(postData);
req.end();
