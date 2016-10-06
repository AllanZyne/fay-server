"use strict";
// jshint browser:true, devel: true

var $ = document.querySelector.bind(document);
var $$ = document.querySelectorAll.bind(document);

function sendData(method, url, data) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.onload = function() {
            let resp = this.response;
            if (resp && resp.error)
                return reject(resp);
            return resolve(resp);
        };
        xhr.onerror = function(err) {
            return reject(err);
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
            let resp = this.response;
            if (resp && resp.error)
                return reject(resp);
            return resolve(resp);
        };
        xhr.onerror = function(err) {
            return reject(err);
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

$.jsonp = function(uri, params) {
    return new Promise(function(resolve, reject) {
        var id = '_' + Math.round(10000 * Math.random());
        var callbackName = 'jsonp_callback_' + id;
        window[callbackName] = function(data) {
            delete window[callbackName];
            var ele = document.getElementById(id);
            ele.parentNode.removeChild(ele);
            resolve(data);
        };

        let queries = [];
        for (let key in params) {
            queries.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
        if (queries.length)
            uri += '?' + queries.join('&');

        var src = uri + '&callback=' + callbackName;
        var script = document.createElement('script');
        script.src = src;
        script.id = id;
        script.addEventListener('error', reject);
        document.body.appendChild(script);
    });
};


// function setCookie(key, value) {
//     document.cookie = `${key}=${value};expires=Fri, 31 Dec 9999 23:59:59 GMT`;
// }

// function getCookie() {
//     console.log(document.cookie);
// }

// $.cookie = setCookie();
