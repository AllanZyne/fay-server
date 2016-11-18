"use strict";
// jshint browser:true, devel: true
/* globals $, $$, PROJECTID, FILEID, LINEID, TERMS, RE_TERMS, baiduFanYi, KeyboardEvent */



function commitLine($line, text) {
    let lineIndex = $line.__$dataset.lineIndex;

    // console.log(`commitLine [${lineIndex}] ${text}`);

    $line.classList.add('committing');
    return $.post(`/api/project/${PROJECTID}/file/${FILEID}/transline/${lineIndex}`, {
        transText: text
    }).then(result => {
        // console.log('commitLine result', result);
        $line.classList.remove('committing');
        $line.classList.add('translated');
    }).catch(err => {
        // TODO: 失败后延时重试
        let $transText = $line.querySelector('.line.translated .text');
        $transText.textContent = $line.__$dataset.transText;
        $line.classList.remove('committing');
    });
}

function unselectLines(restore) {
    let $thats = $$('.line-wrapper.selected');

    for (let $that of $thats) {
        let $text = $that.querySelector('.line.original .text');
        $text.textContent = $that.__$dataset.text;
        $that.__$dataset.text = undefined;

        let $transText = $that.querySelector('.line.translated .text');
        let transText = $that.querySelector('.input textarea').value;
        transText = transText.trim();
        if (restore || (! transText))
            transText = $that.__$dataset.transText;

        $transText.textContent = transText;
        $transText.classList.remove('input');
        $that.classList.remove('selected');

        if ($that.__$dataset.transText !== transText) {
            let speeker = $that.__$dataset.speeker;
            if (speeker) {
                transText = speeker + '　' + transText;
            }
            commitLine($that, transText);

            let sameGroup = $that.__$dataset.sameGroup;
            // console.log(typeof sameGroup, sameGroup);
            if (sameGroup) {
                let $sames = $$(`.line-wrapper.line-group-${sameGroup}`);
                for (let $line of $sames) {
                    if ($line.id === $that.id)
                        continue;
                    $line.classList.add('translated');
                    let $transText = $that.querySelector('.line.translated .text');
                    $transText.textContent = transText;
                }
            }
        }
    }
}

function lineClick(event) {
    // console.log('lineClick');

    // console.log(event.target);
    let $target = event.target;
    if ($target) {
        if ($target.id === 'reset-line') {
            return unselectLines(true);
        } else if ($target.id === 'prev-line') {
            let event = new KeyboardEvent('keydown', {
                ctrlKey: true,
                key: 'k'
            });
            return lineKeyPress(event);
        } else if ($target.id === 'next-line') {
            let event = new KeyboardEvent('keydown', {
                ctrlKey: true,
                key: 'j'
            });
            return lineKeyPress(event);
        }
    }

    let $this = this;

    if ($this.classList.contains('lock') || $this.classList.contains('selected'))
        return;

    unselectLines();

    $this.classList.add('selected');

    // 术语
    let $text = $this.querySelector('.line.original .text');
    let text = $text.textContent;
    $this.__$dataset.text = text;
    if (TERMS) {
        let termedText = text.replace(RE_TERMS, term => {
            term = TERMS[term];
            return `<ruby class="term">${term.term}<rt>${term.explanation}</rt></ruby>`;
        });
        $text.innerHTML = termedText;
    }
    text = text.replace(/(「)|(」)|(\\n)/g, '');
    baiduFanYi(text);

    // 编辑器
    let $transText = $this.querySelector('.line.translated .text');
    let transText = $transText.textContent.trim();

    $this.__$dataset.transText = transText;

    $transText.classList.add('input');
    $transText.innerHTML = '';

    let $textarea = document.createElement('textarea');
    $textarea.value = transText;
    $transText.appendChild($textarea);

    let $controls = document.createElement('div');
    $controls.classList.add('controls');
    $controls.innerHTML =
    '<div class="edit">' +
        '<button id="reset-line" title="关闭(Esc)">&times;</button>' +
    '</div>' +
    '<div class="move">' +
        '<button id="prev-line" title="上一行(Ctrl+K)">&lt;</button>' +
        '<button id="next-line" title="下一行(Ctrl+J)">&gt;</button>' +
    '</div>';

    let $helper = document.createElement('div');
    $helper.classList.add('helper');
    $helper.innerHTML = '<div class="fanyi"></div><div class="terms"></div>';

    $transText.appendChild($textarea);
    $transText.appendChild($controls);
    $transText.appendChild($helper);

    $textarea.focus();

    // console.log('「', transText.startsWith('「'), transText.endsWith('」'));
    // if (transText.startsWith('「')) {
    //     if (transText.endsWith('」'))
    //         $textarea.setSelectionRange(1, transText.length-1);
    //     else
    //         $textarea.setSelectionRange(1, transText.length);
    // } else if (transText.endsWith('」')) {
    //     $textarea.setSelectionRange(0, transText.length-1);
    // }
}

function lineKeyPress(event) {
    // console.log(event);

    if (event.ctrlKey) {
        if (event.key === 'j' || event.key === 'k' ||
            event.key === 'n' || event.key === 'p' ||
            event.key === 'Enter') {
            event.preventDefault();

            let $lineWrapper = $('.line-wrapper.selected');
            let lineIndex = -1;
            if ($lineWrapper) {
                lineIndex = parseInt($lineWrapper.id.slice(1), 10);
            }

            if (event.key === 'j' || event.key === 'n')
                lineIndex++;
            else if (event.key === 'k' || event.key === 'p')
                lineIndex--;

            if (event.key === 'Enter') {
                if (event.shiftKey)
                    lineIndex--;
                else
                    lineIndex++;
            }

            if (lineIndex < 0)
                lineIndex = 0;
            let maxIndex = $$('.line-wrapper').length;
            if (lineIndex >= maxIndex)
                lineIndex = maxIndex - 1;

            $('#L'+lineIndex).click();
        }
    } else if (event.key === 'Escape') {
        event.preventDefault();
        unselectLines(true);
    }
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
    // console.log('getLineData', LineLoading);
    if (LineEnd || LineLoading)
        return;

    let article = $('main article');
    LineLoading = true;

    return Promise.all([
        $.get(`/api/project/${PROJECTID}/file/${FILEID}/line`, {
            page: LinePage,
            per_page: LinePerPage
        })
    ]).then(([lines]) => {
        // console.log('getLineData', lines);

        if (lines.length < LinePerPage) {
            LineEnd = true;
        }

        for (let i = 0, len = lines.length; i < len; i++) {
            let line = lines[i];
            let text = line.text,
                transText = line.transText ? line.transText : line.text;
            let speeker, tranSpeeker;

            let re_text = /^(Elmo|Helen|エルモ|ヘレン|タベル|ハラペ|ガスパ|コレッ|モニカ|サラ|オット|ヴァネ|交渉Ａ|交渉Ｂ|ブラン)　+(.*)/;

            let matches = text.match(re_text);
            if (matches) {
                speeker = tranSpeeker = matches[1];
                text = matches[2];
                if (TERMS && TERMS[tranSpeeker]) {
                    tranSpeeker = TERMS[tranSpeeker].explanation;
                }
            }

            matches = transText.match(re_text);
            if (matches) {
                transText = matches[2];
            }

            let lineWrapper = document.createElement('div');

            lineWrapper.id = 'L'+LineIndex;
            lineWrapper.__$dataset = {};
            lineWrapper.__$dataset.lineIndex = LineIndex;
            lineWrapper.__$dataset.lineId = line._id;
            lineWrapper.__$dataset.speeker = speeker ? speeker : '';
            lineWrapper.__$dataset.userId = line.userId;
            lineWrapper.__$dataset.commitTime = line.time;
            lineWrapper.__$dataset.edited = line.edited;
            lineWrapper.__$dataset.sameGroup = line.sameGroup;
            LineIndex++;

            lineWrapper.classList.add('line-wrapper');
            if (line.lock)
                lineWrapper.classList.add('lock');
            if ((! line.edited) && (line.sameGroup !== null)) {
                lineWrapper.classList.add(`line-group-${line.sameGroup}`);
            }
            if (transText !== text)
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
    let $path = $('#path');
    $path.innerHTML = `<a href="/">/</a><a href="/${PROJECTID}">${PROJECTID}</a>/<a href="/${PROJECTID}/${FILEID}">${FILEID}</a>`;

    let main = $('main .container');
    main.innerHTML = '<article class="left-up center"></article>';
    main.addEventListener('scroll', articalScroll);
    main.addEventListener('keydown', lineKeyPress);

    LinePage = LineIndex = 0;
    LineLoading = LineEnd = false;
    ScrollTicking = false;

    return getLineData();
}

