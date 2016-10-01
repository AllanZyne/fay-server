"use strict";
// jshint browser:true, devel: true

var $ = document.querySelector.bind(document);
var $$ = document.querySelectorAll.bind(document);

function sendData(method, url, data) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.onload = function() {
            resolve(this.response);
        };
        xhr.onerror = function(err) {
            reject(err);
        };
        xhr.responseType = 'json';
        xhr.send(data);
    });
}

function getData(method, url, params) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        let queries = [];
        for (let key in params) {
            queries.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
        if (queries.length)
            url += '?' + queries.join('&');
        xhr.open(method, url);
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
}

$.get = getData.bind(null, 'GET');
$.post = sendData.bind(null, 'POST');
$.put = sendData.bind(null, 'PUT');
$.delete = getData.bind(null, 'DELETE');

// function setCookie(key, value) {
//     document.cookie = `${key}=${value};expires=Fri, 31 Dec 9999 23:59:59 GMT`;
// }

// function getCookie() {
//     console.log(document.cookie);
// }

// $.cookie = setCookie();
