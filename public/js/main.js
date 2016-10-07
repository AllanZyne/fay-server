"use strict";
// jshint browser:true, devel: true
/* globals $, getLines, MyTable */


window.addEventListener("load", function () {
    checkURL();
});

window.addEventListener("popstate", function () {
    checkURL();
});


var PROJECTID, FILEID, LINEID;
var TERMS, USER;


function parseURL() {
    let pathname = window.location.pathname.split('/');
    PROJECTID = pathname[1];
    FILEID = pathname[2];
    LINEID = window.location.hash.slice(2);

    console.log('parseURL', {
        PROJECTID: PROJECTID,
        FILEID: FILEID,
        LINEID: LINEID
    });
}

function changeURL(urlPath) {
    // window.history.replaceState({},"", urlPath);
    window.history.pushState({}, "", urlPath);
}

function getError(err) {
    let $container = $('main .container');

    console.log(err);

    $container.innerHTML = `<div class="error">
        <h3>错误请求</h3>
        <pre>${JSON.stringify(err, null, 4)}</pre>
    </div>`;
}

function checkURL() {
    console.log('checkURL', window.location);

    // XXXX: 404.html
    parseURL();
    
    getNav().catch(getError);

    if (! PROJECTID) {
        return getProjects().catch(getError);
    }

    switch(PROJECTID) {
        // case 'user':
        //     return getUser();
        case 'terms':
            return getTermsData().then(getTerms).catch(getError);
        default:
            if (FILEID)
                return getTermsData().then(getLines).catch(getError);
            return getFiles().catch(getError);
    }
}

function getNav() {
    return getUser();
}

function getUser() {
    return $.get('/api/user').then(user => {
        console.log('/api/user', user);
        USER = user;
        $('#username').textContent = `${user._id}`;
        $('#notify').textContent = `notify(${user.newNotify})`;
    });
}

function getTermsData() {
    return $.get('/api/terms').then(terms => {
        TERMS = terms;
        for (let term of terms) {
            TERMS[term.term] = term;
        }
    });
}


function getTerms() {
    let $container = $('.container');
    $container.innerHTML = '';

    let $terms = document.createElement('div');
    $terms.classList.add('terms');

    $terms.innerHTML =
'    <dl class="terms-list"></dl>' +
'    <form method="post" action="/api/terms">' +
'      <fieldset>' +
'        <legend>添加名词</legend>' +
'        <div>' +
'          <label for="term">名词</label>' +
'          <input type="text" id="term" name="term" required>' +
'        </div>' +
'        <div>' +
'          <label for="explanation">解释</label>' +
'          <textarea id="explanation" name="explanation" required></textarea>' +
'        </div>' +
'        <div>' +
'          <input type="reset" value="重置" />' +
'          <input type="submit" value="添加" />' +
'        </div>' +
'      </fieldset>';

    $container.appendChild($terms);

    let $termList = $('.terms dl');
    for (let term of TERMS) {
        $termList.innerHTML += `<dt>${term.term}</dt><dd>${term.explanation}</dd>`;
    }
}

function getProjects() {
    let $path = $('#path');
    $path.innerHTML = `<a href="/">/</a>`;

    return $.get('/api/project').then((data) => {
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

        $('main .container').innerHTML = '';
        $('main .container').appendChild(table.render());
    });
}


function getFiles() {
    let $path = $('#path');
    $path.innerHTML = `<a href="/">/</a><a href="/${PROJECTID}">${PROJECTID}</a>`;

    return $.get(`/api/project/${PROJECTID}/file`, {}).then((data) => {
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

        $('main .container').innerHTML = '';
        $('main .container').appendChild(table.render());
    });
}
