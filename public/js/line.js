"use strict";
// jshint browser:true, devel: true
/* globals $, $$, PROJECTID, FILEID, LINEID */

// var PROJECTID = 'AiryFairy';
// var FILEID = 'ss527aa01.sjsx';
// var LINEID;

// function commitClick(event) {
//     console.log('commitClick');

//     let text = $('.input textarea').value;
//     let speeker = $('.line-editor .line.original .speeker');
//     if (speeker) {
//         speeker = speeker.textContent;
//         text = speeker + '　' + text;
//     }

//     console.log('commitClick', text);

//     $.post(`/api/project/${PROJECTID}/file/${FILEID}/transline/${LINEID.slice(1)}`, text).then(
//         result => console.log(result),
//         err    => console.log(err)
//     );
// }

function commitLine(lineid, text) {
    console.log('commitLine', lineid, text);

    $.post(`/api/project/${PROJECTID}/file/${FILEID}/transline/${lineid}`, text).then(
        result => {
            console.log('commitLine', lineid, result);
            $('#L'+lineid).classList.add('translated');
        },
        err    => console.log('commitLine', lineid, err)
    );
}


function lineClick(event) {
    // console.log('lineClick');

    if (this.classList.contains('lock') || this.classList.contains('selected'))
        return;

    let thats = $$('.line-wrapper.selected');
    let thatCommits = [];
    for (let that of thats) {
        let transline = that.querySelector('.line.translated .text');
        let text = that.querySelector('.input textarea').value;
        text = text.trim();
        transline.textContent = text;
        transline.classList.remove('input');
        that.classList.remove('selected');

        if (that.dataset.text != text) {
            let speeker = that.dataset.speeker;
            if (speeker) {
                text = speeker + '　' + text;
            }
            commitLine(that.id.slice(1), text);
        }
    }

    this.classList.add('selected');

    // let editor = $('main .line-editor');
    // editor.innerHTML = this.outerHTML;
    // editor.style.display = 'block';

    let transline = this.querySelector('.line.translated .text');
    let transtext = transline.textContent;

    this.dataset.text = transtext;

    transline.classList.add('input');
    transline.innerHTML = '';

    let textarea = document.createElement('textarea');
    textarea.value = transtext;
    transline.appendChild(textarea);

    // let commit = transline.querySelector('#commit');
    // commit.addEventListener('click', commitClick);
}


const LinePerPage = 30;
let LinePage = 0, LineIndex = 0;
let LineLoading = false, LineEnd = false;
let ScrollTicking = false;


function updateScroll(event) {
    var element = event.target;
    var a = element.scrollTop;
    var b = element.scrollHeight - element.clientHeight;
    // console.log('scroll', a/b);
    if (a == b) {
        getLineData();
    }
}

function articalScroll(event) {
    if (! ScrollTicking) {
        ScrollTicking = true;
        window.requestAnimationFrame(function() {
            updateScroll(event);
            ScrollTicking = false;
        });
    }
}

function getLineData() {
    console.log('getLineData', LineLoading);
    if (LineEnd || LineLoading)
        return;

    let article = $('main article');
    LineLoading = true;

    Promise.all([
        $.get(`/api/project/${PROJECTID}/file/${FILEID}/line`, {
            page: LinePage,
            per_page: LinePerPage
        }),
        $.get(`/api/project/${PROJECTID}/file/${FILEID}/transline?page=${LinePage}`, {
            page: LinePage,
            per_page: LinePerPage
        })
    ]).then(([lines, translines]) => {
        // console.log(lines);
        // console.log('translines', translines);

        if (lines.length < LinePerPage) {
            LineEnd = true;
        }

        for (let i = 0, len = lines.length; i < len; i++) {
            let line = lines[i], trans = translines[i].commits;
            let text = line.text,
                transText = text;
            if (trans.length > 0) {
                transText = trans[trans.length - 1].text;
            }

            let speeker, tranSpeeker;
            let m = text.indexOf('　');
            if (m > 0) {
                speeker = tranSpeeker = text.slice(0, m);
                text = text.slice(m+1);
            }
            m = transText.indexOf('　');
            if (m > 0) {
                transText = transText.slice(m+1);
            }

            let lineWrapper = document.createElement('div');

            lineWrapper.id = 'L'+LineIndex;
            lineWrapper.dataset.speeker = speeker;
            LineIndex++;

            lineWrapper.classList.add('line-wrapper');
            if (line.lock)
                lineWrapper.classList.add('lock');
            if (trans.length)
                lineWrapper.classList.add('translated');

            lineWrapper.innerHTML = '<div class="line original">' +
                (speeker ? `<p class="speeker">${speeker}</p>`:'') +
                `<p class="text">${text}</p>` +
            '</div>' +
            '<div class="line translated">' +
                (tranSpeeker ? `<p class="speeker">${tranSpeeker}</p>`:'') +
                `<p class="text">${transText}</p>` +
            '</div>';

            lineWrapper.addEventListener('click', lineClick);

            article.appendChild(lineWrapper);
        }

        LinePage++;
        LineLoading = false;
    }, err => {
        console.log(err);
    });
}

function getLines() {
    let main = $('main .container');
    main.innerHTML = '<article class="left-up center"></article>';
    main.addEventListener('scroll', articalScroll);

    LinePage = LineIndex = 0;
    LineLoading = LineEnd = false;
    ScrollTicking = false;

    getLineData();
}

// getLines();
