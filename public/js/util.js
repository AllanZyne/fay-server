"use strict";
// jshint browser:true, devel: true

var $ = document.querySelector.bind(document);
var $$ = document.querySelectorAll.bind(document);

function sendData(method, url, data) {
    return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.onload = function() {
            resolve(JSON.parse(this.response));
        };
        xhr.onerror = function(err) {
            reject(err);
        };
        xhr.send(data);
    });
}

var getData = function(url, params, token) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        let queries = [];
        for (let key in params) {
            queries.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
        url += '?' + queries.join('&');
        if (token)
            url += '&token=' + token;
        console.log('getData', url);
        xhr.open('GET', url);
        xhr.onload = function() {
            resolve(this.response);
        };
        xhr.onerror = function(err) {
            reject(err);
        };
        // xhr.withCredentials = true;
        xhr.responseType = 'json';
        // xhr.setRequestHeader('Access-Control-Allow-Origin', '');
        xhr.send();
    });
};

var postData = sendData.bind(null, 'POST');
var putData = sendData.bind(null, 'PUT');
var deleteData = sendData.bind(null, 'DELETE');


function setCookie(key, value) {
    document.cookie = `${key}=${value};expires=Fri, 31 Dec 9999 23:59:59 GMT`;
}

function getCookie() {
    console.log(document.cookie);
}
