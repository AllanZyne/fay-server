"use strict";

//
(function View() {
    let VmData = {
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
        selectedLineIndex: -1,
    };

    let vm;

    function showFilesView() {
        if (vm)
            return;
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
            },
            methods: {
                toggleHistory(line, evt) {

                },
                toggleClone(line, evt) {

                },
                toggleTransation(line, evt) {

                },
            }
        })
    }

    function showLinesView() {
        if (vm)
            return;
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
                    return (100 - this.transPercent).toFixed(2);
                },
            },
            methods: {
                selectLine(line, event) {
                    console.log('line', line);
                    console.log('tag', event.target.tagName);
                    line.isEdit = true;
                }
            }
        })
    }
    window.VmData = VmData;
    window.View = {
        showFilesView: showFilesView,
        showLinesView: showLinesView,
    };
})();

//
(function Model() {
    function getProject(project) {
        return $.get(`/api/project/${project}`).then(projects => projects[0]);
    }

    function getFiles(project) {
        return $.get(`/api/project/${project}/file`);
    }

    function getFile(project, file) {
        return $.get(`/api/project/${project}/file/${file}`);
    }

    function getLines(project, file) {
        return $.get(`/api/project/${project}/file/${file}/line`, { page: 0, per_page: 30 }).then(lines => {
            for (let line of lines) {
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
                line.isEdit = false;
            }
            return lines;
        });
    }

    function getLineHistory(lineId) {
        return $.get(`/api/line/${lineId}/history`);
    }

    function getUser() {
        return $.get('/api/user');
    }

    window.Model = {
        getProject: getProject,
        getFile: getFile,
        getFiles: getFiles,
        getLines: getLines,
        getUser: getUser,
        getLineHistory: getLineHistory,
    };
})();


(function Router() {
    page('/', '/AiryFairy');  // XXXX: no root page

    page('/:project/', refreshUser, refreshFiles, project);
    page('/:project/:file', refreshUser, refreshFile, refreshLines, file);

    page('/user', user);
    page('/setting', user);
    page('/statics', user);

    // page('/logout', user);

    page('/error', error);
    page('*', notfound);

    page.show('/AiryFairy/ss527aa02.sjsx');

    function refreshUser(context, next) {
        Model.getUser().then(user => {
            console.log('user', user);
            VmData.username = user._id;
            VmData.notifyCount = user.newNotify;
        });
        next();
    }

    function refreshProject(context, next) {
        let { project } = context.params;
        Model.getProject(project).then(project => {
            console.log('project', project);
            VmData.projectName = project.name;
            VmData.locksCount = project.locksCount;
            VmData.transCount = project.transCount;
            VmData.linesCount = project.linesCount;
        });
        next();
    }

    function refreshFile(context, next) {
        let { project, file } = context.params;
        Model.getFile(project, file).then(file => {
            console.log('file', file);
            VmData.projectName = file.name;
            VmData.locksCount = file.locksCount;
            VmData.transCount = file.transCount;
            VmData.linesCount = file.linesCount;
        });
        next();
    }

    function refreshFiles(context, next) {
        let { project, file } = context.params;
        Model.getFiles(project, file).then(files => {
            let recentFiles = [];
            let hxxxFiles = [];
            let commonFiles = [];

            for (let file of files) {
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
        });
        next();
    }

    function refreshLines(context, next) {
        let { project, file } = context.params;
        Model.getLines(project, file).then(lines => {
            console.log('lines', lines);
            lines[2].isEdit = true;
            VmData.lines = lines;
        });
        next();
    }

    function project(context, next) {
        View.showFilesView();
        next();
    }

    function file(context, next) {
        View.showLinesView();
        next();
    }

    function user() {

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
