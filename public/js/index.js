"use strict";
// jshint browser:true, devel: true

var $ = document.querySelectorAll.bind(document);

function sendData(url, method, data) {
    return new Promise((resolve, reject) => {
        var XHR = new XMLHttpRequest();

        XHR.addEventListener("load", function(event) {
            resolve(event.target.responseText);
        });
        XHR.addEventListener("error", function(event) {
            reject(event);
        });
        XHR.open(method, url);
        XHR.send(data);
    });
}

function postData(url, data) {
    return sendData(url, 'POST', data);
}

function getData(url, data) {
    return sendData(url, 'GET', data);
}

// function putData(url, data) {
//     return sendData(url, 'PUT', data);
// }

// function deleteData(url, data) {
//     return sendData(url, 'DELETE', data);
// }

function login(user, password) {
    return sendData(`/user/`);
}

function getProjects() {
    return getData('/project');
}

/*

xxxx/

xxxx/AiryFairy

xxxx/AiryFairy/ss527aa01.sjsx

xxxx/AiryFairy/ss527aa01.sjsx#L1212

*/

function getFiles(projectId) {
    return getData(`/project/${projectId}`);
}

function getLines(projectId, fileId) {
    return getData(`/project/${projectId}/file/${fileId}`);
}

function getTransLines(projectId, fileId, lineId) {
    return getData(`/project/${projectId}/file/${fileId}/line/${lineId}`);
}

function putTransLines(projectId, fileId, lineId, text, userId) {
    return putData(`/project/${projectId}/file/${fileId}/line/${lineId}`, {
        userId: userId,
        text: text
    });
}

window.addEventListener("load", function () {

  // We need to access the form element
  var form = document.getElementById("myForm");

  // to takeover its submit event.
  form.addEventListener("submit", function (event) {
    event.preventDefault();
        var FD  = new FormData(form);
    sendData();
  });
});

