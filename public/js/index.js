"use strict";
// jshint browser:true, devel: true

var $ = document.querySelector.bind(document);
var $$ = document.querySelectorAll.bind(document);


function sendData(method, url, data) {
    return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.onload = function() {
            resolve(JSON.parse(xhr.response));
        };
        xhr.onerror = function(err) {
            reject(err);
        };
        xhr.send(data);
    });
}

var getData = sendData.bind(null, 'GET');
var postData = sendData.bind(null, 'POST');
var putData = sendData.bind(null, 'PUT');
var deleteData = sendData.bind(null, 'DELETE');


// function login(user, password) {
//     return sendData(`/user/`);
// }

// function getProjects() {
//     return getData('/project');
// }


var PROJECTID, FILEID, LINEID;

/*
/
/AiryFairy
/AiryFairy/ss527aa01.sjsx
/AiryFairy/ss527aa01.sjsx#L1212
*/
function parseURL() {
    var urls = location.pathname.split('/');
    PROJECTID = urls[1];
    FILEID = urls[2];
    LINEID = location.hash.slice(2);
}

// function getFiles(projectId) {
//     return getData(`/project/${projectId}`);
// }

// function getLines(projectId, fileId) {
//     return getData(`/project/${projectId}/file/${fileId}`);
// }

// function getTransLines(projectId, fileId, lineId) {
//     return getData(`/project/${projectId}/file/${fileId}/line/${lineId}`);
// }

// function putTransLines(projectId, fileId, lineId, text, userId) {
//     return putData(`/project/${projectId}/file/${fileId}/line/${lineId}`, {
//         userId: userId,
//         text: text
//     });
// }

// window.addEventListener("load", function () {

//   // We need to access the form element
//   var form = document.getElementById("myForm");

//   // to takeover its submit event.
//   form.addEventListener("submit", function (event) {
//     event.preventDefault();
//         var FD  = new FormData(form);
//     sendData();
//   });
// });

