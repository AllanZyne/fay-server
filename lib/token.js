const hat = require('hat');


let LoginTokens = new Map();
const EXPIREDTIME = 1*60*60*1000;


function newToken() {
    let expiredTokens = [], now = Date.now();
    for (let [key, value] of LoginTokens) {
        if (now - value > EXPIREDTIME)
            expiredTokens.push(key);
    }
    for (let key of expiredTokens)
        LoginTokens.delete(key);

    let token = hat();
    LoginTokens.set(token, now);
    return token;
}

function checkToken(token) {
    let time = LoginTokens.get(token);
    if ((! time) || (Date.now() - time > EXPIREDTIME))
        return false;
    return true;
}

function updateToken(token) {
    if (! LoginTokens.get(token))
        return false;
    LoginTokens.set(token, Date.now());
    return true;
}

function deleteToken(token) {
    LoginTokens.delete(token);
}


exports.newToken = newToken;
exports.checkToken = checkToken;
exports.updateToken = updateToken;
exports.deleteToken = deleteToken;
