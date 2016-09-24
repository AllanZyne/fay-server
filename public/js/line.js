
// var PROJECTID = 'AiryFairy';
// var FILEID = 'ss527aa01.sjsx';
// var LINEID;

function commitClick(event) {
    console.log('commitClick');

    let text = $('.input textarea').value;
    let speeker = $('.line-editor .line.original .speeker');
    if (speeker) {
        speeker = speeker.textContent;
        text = speeker + '　' + text;
    }

    console.log('commitClick', text);

    $.post(`/api/project/${PROJECTID}/file/${FILEID}/transline/${LINEID.slice(1)}`, text).then(
        result => console.log(result),
        err    => console.log(err)
    );
}

function lineClick(event) {
    console.log('lineClick');

    if (this.classList.contains('lock'))
        return;

    let others = $$('.line-wrapper.selected');
    for (let other of others) {
        other.classList.remove('selected');
    }
    this.classList.add('selected');

    LINEID = this.id;

    let editor = $('main .line-editor');
    editor.innerHTML = this.outerHTML;
    editor.style.display = 'block';

    let transline = editor.querySelector('.line.translated .text');
    let transtext = transline.textContent;

    transline.classList.add('input');
    transline.innerHTML = '<textarea>' + transtext + '</textarea>' +
    '<div class="pannel">' +
        '<button class="blue">取消</button>' +
        '<button class="yellow">历史</button>' +
        '<button class="green" id="commit">提交</button>' +
    '</div>';

    let commit = transline.querySelector('#commit');
    commit.addEventListener('click', commitClick);
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
        getData(`/api/project/${PROJECTID}/file/${FILEID}/line`, {
            page: LinePage,
            per_page: LinePerPage
        }),
        getData(`/api/project/${PROJECTID}/file/${FILEID}/transline?page=${LinePage}`, {
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

            let speeker = '', tranSpeeker = '';
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
            LineIndex++;

            lineWrapper.classList.add('line-wrapper');
            if (line.lock)
                lineWrapper.classList.add('lock');
            if (trans.length)
                lineWrapper.classList.add('translated');

            lineWrapper.innerHTML = '<div class="line original">' +
                (speeker.length ? `<p class="speeker">${speeker}</p>`:'') +
                `<p class="text">${text}</p>` +
            '</div>' +
            '<div class="line translated">' +
                (tranSpeeker.length ? `<p class="speeker">${tranSpeeker}</p>`:'') +
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
    let main = $('main');
    main.innerHTML = '<div class="left-wrapper">' +
        '<article class="left-up center"></article>' +
        '<div class="left-down line-editor" style="display: none;">' +
            '<div class="line-wrapper">' +
                '<div class="line original">' +
                '</div>' +
                '<div class="line translated">' +
                '</div>' +
            '</div>' +
        '</div>' +
    '</div>';

    let article = $('main article');
    article.addEventListener('scroll', articalScroll);

    let editor = $('main .line-editor');

    LinePage = LineIndex = 0;
    LineLoading = LineEnd = false;
    ScrollTicking = false;

    getLineData();
}

// getLines();
