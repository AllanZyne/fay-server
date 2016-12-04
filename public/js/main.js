"use strict";

//
(function View() {
    var VmData = {
        username: '',
        projectName: '',
        fileName: '',
        notifyCount: 0,
        transCount: 0,
        locksCount: 0,
        linesCount: 1,
        recentFiles: [],
        projectFiles: [],
        lines: [],
    };

    var vm = new Vue({
        el: 'body',
        data: VmData,
        computed: {
            untransCount() {
                return this.linesCount - this.transCount;
            },
            locksPercent() {
                return (this.locksCount/this.linesCount*100).toFixed(2);
            },
            transPercent() {
                return (this.transCount/this.linesCount*100).toFixed(2);
            },
            untransPercent() {
                return 100 - this.transPercent;
            },
        }
    });

    window.VmData = VmData;
})();

//
(function Model() {
    function getProject() {
        return $.get('/api/project/AiryFairy');
    }

    function getFiles() {
        return $.get(`/api/project/AiryFairy/file`);
    }

    function getLines() {
        return Promise.all([$.get(`/api/project/AiryFairy/file/ss527aa02.sjsx/line`, {
            page: 0,
            per_page: 30
        })]).then(([lines]) => {
            // console.log(lines);
            for (let line of lines) {
                // let line = lines[i];
                let text = line.text,
                    transText = line.transText ? line.transText : line.text;
                let speeker, tranSpeeker;
                let re_text = /^(Elmo|Helen|ハム|チェリ|エルモ|ヘレン|タベル|ハラペ|ガスパ|コレッ|モニカ|サラ|オット|ヴァネ|交渉Ａ|交渉Ｂ|ブラン)　+(.*)/;

                let matches = text.match(re_text);
                if (matches) {
                    speeker = tranSpeeker = matches[1];
                    text = matches[2];
                }

                matches = transText.match(re_text);
                if (matches) {
                    transText = matches[2];
                }

                line.speeker = speeker;
                line.text = text;
                line.transText = transText;
            }

            return lines;
        });
    }

    function getUser() {
        return $.get('/api/user');
    }

    window.Model = {
        getProject: getProject,
        getFiles: getFiles,
        getLines: getLines,
        getUser: getUser,
    };
})();


(function Router() {
    page('/', '/AiryFairy');
    page('/:project/', refreshUser, index);
    page('/:project/:file/', refreshUser, file);
    page('/user', user);
    page('/setting', user);
    page('/statics', user);
    // page('/logout', user);
    page('/error', error);
    page('*', notfound);
    page();

    function refreshUser(context, next) {
        Model.getUser().then(user => {
            VmData.username = user._id;
            VmData.notifyCount = user.newNotify;
        });
        next();
    }

    function index(context, next) {

        Model.getProject().then(projects => {
            let recentFiles = [];

            let hxxxFiles = [];
            let commonFiles = [];

            for (let file of data) {
                file.untransCount = file.linesCount - file.transCount;
                file.transPercent = file.transCount/file.linesCount*100;
                file.lastActivity = "未更新";
                if ((file.untransCount != file.linesCount) && (file.untransCount > 20)) {
                    recentFiles.push(file);
                }

                if (file.name[0] === 'h')
                    hxxxFiles.push(file);
                else
                    commonFiles.push(file);
            }

            let projectFiles = [];
            projectFiles.push({ group: "COMMON"});
            projectFiles = projectFiles.concat(commonFiles);
            projectFiles.push({ group: "H-SCENCE"});
            projectFiles  = projectFiles.concat(hxxxFiles);

            VmData.projectFiles = projectFiles;
            VmData.recentFiles = recentFiles;

            VmData.projectName = projects[0].name;
            VmData.locksCount = projects[0].locksCount;
            VmData.transCount = projects[0].transCount;
            VmData.linesCount = projects[0].linesCount;
        });

        // Model.getFiles().then(files => {
            // let recentFiles = [];

            // let hxxxFiles = [];
            // let commonFiles = [];

            // for (let file of data) {
            //     file.untransCount = file.linesCount - file.transCount;
            //     file.transPercent = file.transCount/file.linesCount*100;
            //     file.lastActivity = "未更新";
            //     if ((file.untransCount != file.linesCount) && (file.untransCount > 20)) {
            //         recentFiles.push(file);
            //     }

            //     if (file.name[0] === 'h')
            //         hxxxFiles.push(file);
            //     else
            //         commonFiles.push(file);
            // }

            // let projectFiles = [];
            // projectFiles.push({ group: "COMMON"});
            // projectFiles = projectFiles.concat(commonFiles);
            // projectFiles.push({ group: "H-SCENCE"});
            // projectFiles  = projectFiles.concat(hxxxFiles);

            // VmData.projectFiles = projectFiles;
            // VmData.recentFiles = recentFiles;
        // });

        Model.getLines().then(lines => {
            lines[2].isEdit = true;
            VmData.lines = lines;
        });
    }

    function file() {

    }

    function user() {
        .then(user => {
                    // console.log('/api/user', user);

                });
    }

    function notfound() {

    }

    function error() {

    }
})();

// function getTermsData() {
//     return $.get('/api/terms').then(terms => {
//         console.log('getTermsData', terms);
//         if (terms.length) {
//             TERMS = terms;
//             let termsList = [];
//             for (let term of terms) {
//                 TERMS[term.term] = term;
//                 termsList.push(term.term);
//             }
//             RE_TERMS = new RegExp(termsList.join('|'), 'g');
//         } else {
//             TERMS = null;
//             RE_TERMS = null;
//             TERMSLIST = null;
//         }
//     });
// }

// function getTerms() {
//     let $container = $('.container');
//     $container.innerHTML = '';

//     let $terms = document.createElement('div');
//     $terms.classList.add('terms');

//     $terms.innerHTML =
// '    <dl class="terms-list"></dl>' +
// '    <form method="post">' +
// '      <fieldset>' +
// '        <legend>添加名词</legend>' +
// '        <div>' +
// '          <label for="term">名词</label>' +
// '          <input type="text" id="term" name="term" required>' +
// '        </div>' +
// '        <div>' +
// '          <label for="explanation">解释</label>' +
// '          <textarea id="explanation" name="explanation" required></textarea>' +
// '        </div>' +
// '        <div>' +
// '          <input type="reset" value="重置" />' +
// '          <input type="submit" value="添加" />' +
// '        </div>' +
// '      </fieldset>';

//     $container.appendChild($terms);

//     $terms.addEventListener('submit', function(event) {
//         event.preventDefault();

//         let term = $terms.querySelector('#term').value,
//             explanation = $terms.querySelector('#explanation').value;
//         // console.log(term, explanation);
//         if (TERMS && (term in TERMS)) {
//             let termData = TERMS[term];
//             $.put('/api/terms', {
//                 termId: termData._id,
//                 explanation: explanation
//             }).then(_ => {
//                 // termData.$dd.textContent = explanation;
//                 window.location.reload();
//             }).catch(err => {
//             });
//         } else {
//             $.post('/api/terms', {
//                 term: term,
//                 explanation: explanation
//             }).then(termData => {
//                 // TERMS[term] = termData;
//                 // let $dl = $terms.querySelector('dl');
//                 // let $dt = document.createElement('dt');
//                 // $dt.textContent = termData.term;
//                 // let $dd = document.createElement('dd');
//                 // $dd.textContent = termData.explanation;
//                 // termData.$dd = $dd;
//                 // $dl.appendChild($dt);
//                 // $dl.appendChild($dd);
//                 window.location.reload();
//             }).catch(err => {
//                 console.log('commit terms', err);
//             });
//         }
//     });

//     let $dl = $terms.querySelector('dl');
//     if (TERMS)
//         for (let termData of TERMS) {
//             let $dt = document.createElement('dt');
//             $dt.textContent = termData.term;
//             let $dd = document.createElement('dd');
//             $dd.textContent = termData.explanation;
//             termData.$dd = $dd;
//             $dl.appendChild($dt);
//             $dl.appendChild($dd);
//         }
// }
