"use strict";
// jshint browser:true, devel: true
/* globals $, getData, MyTable */


var PROJECTID, FILEID, LINEID;
var LOGINTOKEN;

function parseURL() {
    let pathname = window.location.pathname.split('/');
    PROJECTID = pathname[1];
    FILEID = pathname[2];
    LINEID = window.location.hash.slice(2);
    let m = window.location.search.match('token=([^&]+)');
    if (m)
        LOGINTOKEN = m[1];
}

function changeURL(urlPath) {
    // window.history.replaceState({},"", urlPath);
    window.history.pushState({},"", urlPath);
}

function checkURL() {
    // XXXX: 404.html
    parseURL();
    if (PROJECTID) {
        if (FILEID) {
            getLines();
        } else {
            getFiles();
        }
    } else {
        getProjects();
    }
}

window.addEventListener("load", function () {
    checkURL();
});

window.addEventListener("popstate", function () {
    checkURL();
});


function getProjects() {
    getData('/api/project', {}, LOGINTOKEN).then((data) => {
        console.log('/api/project', data);

        let table = new MyTable();
        table.setColumns([
            { name: '项目', key: 'name', href: '${row.name}'},
            { name: '总段数', key: 'linesCount' },
            { name: '已翻译', key: 'transCount' },
            { name: '已锁定', key: 'locksCount' },
            { name: '完成度', key: '${(row.transCount/row.linesCount*100).toFixed(2)}%'}
        ]);
        table.setData(data);
        table.on('click', function(event) {
            event.preventDefault();
            let target = event.target;
            if (target.tagName === 'A') {
                changeURL(target.href);
                checkURL();
            }
        });

        $('main').innerHTML = '';
        $('main').appendChild(table.render());
    });
}


function getFiles() {
    getData(`/api/project/${PROJECTID}/file`, {}, LOGINTOKEN).then((data) => {
        console.log('/api/project/file', data);

        if (! data)
            data = [];

        let table = new MyTable();
        table.setColumns([
            { name: '文件', key: 'name', href: PROJECTID + '/${row.name}'},
            { name: '段数', key: 'linesCount' },
            { name: '已翻译', key: 'transCount' },
            { name: '已锁定', key: 'locksCount' },
            { name: '完成度', key: '${(row.transCount/row.linesCount*100).toFixed(2)}%'}
        ]);
        table.setData(data);
        table.on('click', function(event) {
            event.preventDefault();
            let target = event.target;
            if (target.tagName === 'A') {
                changeURL(target.href);
                checkURL();
            }
        });

        $('main').innerHTML = '';
        $('main').appendChild(table.render());
    });
}

function getLines() {

}
