"use strict";
// jshint browser:true, devel: true
/* globals $, $$, PROJECTID, FILEID, LINEID, baiduFanYi, KeyboardEvent */

//
// TODO
//
// [X] control+j/k 上下
// [-] 自动选择
// [X] sameGroup
// [] 词典
// [X] 自动翻译
// [] 术语(快速添加)
// [] URL hash跳转
//


function commitLine($line, text) {
    let lineIndex = $line.dataset.lineIndex;

    // console.log('commitLine', lineIndex);
    // console.log('commitLine', text);

    $line.classList.add('committing');
    return $.post(`/api/project/${PROJECTID}/file/${FILEID}/transline/${lineIndex}`, text)
        .then(result => {
            // console.log('commitLine result', result);
            $line.classList.remove('committing');
            $line.classList.add('translated');
        }).catch(err => {
            let $transText = $line.querySelector('.line.translated .text');
            $transText.textContent = $line.dataset.transText;
            $line.classList.remove('committing');
        });
}

function unselectLines(restore) {
    let $thats = $$('.line-wrapper.selected');

    for (let $that of $thats) {
        let $transText = $that.querySelector('.line.translated .text');
        let text = $that.querySelector('.input textarea').value;
        text = text.trim();
        if (restore || (! text))
            text = $that.dataset.transText;

        $transText.textContent = text;
        $transText.classList.remove('input');
        $that.classList.remove('selected');

        if ($that.dataset.transText !== text) {
            let speeker = $that.dataset.speeker;
            if (speeker) {
                text = speeker + '　' + text;
            }
            commitLine($that, text);

            let sameGroup = $that.dataset.sameGroup;
            // console.log(typeof sameGroup, sameGroup);
            if (sameGroup) {
                let $sames = $$(`.line-wrapper.line-group-${sameGroup}`);
                for (let $line of $sames) {
                    if ($line.id === $that.id)
                        continue;
                    $line.classList.add('translated');
                    let $transText = $that.querySelector('.line.translated .text');
                    $transText.textContent = text;
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

    let $transText = $this.querySelector('.line.translated .text');
    let transText = $transText.textContent.trim();

    $this.dataset.transText = transText;

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

    let $text = $this.querySelector('.line.original .text');
    let query = $text.textContent;
    query = query.replace(/(「)|(」)|(\\n)/g, '');
    // console.log(query);
    baiduFanYi(query);
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
        // console.log('translines', translines);

        if (lines.length < LinePerPage) {
            LineEnd = true;
        }

        for (let i = 0, len = lines.length; i < len; i++) {
            let line = lines[i];
            let text = line.text,
                transText = line.transText ? line.transText : line.text;
            let speeker, tranSpeeker;

            let matches = text.match(/(\S+)　+(\S*)/);
            if (matches) {
                speeker = tranSpeeker = matches[1];
                text = matches[2];
            }
            matches = transText.match(/(\S+)　+(\S*)/);
            if (matches) {
                transText = matches[2];
            }

            let lineWrapper = document.createElement('div');

            lineWrapper.id = 'L'+LineIndex;
            lineWrapper.dataset.lineIndex = LineIndex;
            lineWrapper.dataset.lineId = line._id;
            lineWrapper.dataset.speeker = speeker ? speeker : '';
            lineWrapper.dataset.userId = line.userId;
            lineWrapper.dataset.commitTime = line.time;
            lineWrapper.dataset.edited = line.edited;
            lineWrapper.dataset.sameGroup = line.sameGroup;
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

// getLines();
