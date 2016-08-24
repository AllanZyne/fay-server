

function projectClick(event) {
    let el = event.target;
    PROJECTID = el.id;
    console.log('projectClick');
    getFiles();
}

function fileClick(event) {
    let el = event.target;
    FILEID = el.id;
    console.log('fileClick');
    getLines();
}



function getProjects() {
    let tbody = $('tbody')[0];
    tbody.innerHTML = '';
    getData('/api/project').then((data) => {
        for (let i in data) {
            let p = data[i];
            let row =
            `<td>${i}</td>
             <td id=${i}>${p.name}</td>
             <td>文本数 ${p.linesCount} 段 | 已翻译 ${p.transCount} 段 | 已锁定 ${p.locksCount} 段 | 完成度 ${(p.transCount/p.linesCount*100).toFixed(2)}% </td>`;
            let tr = document.createElement('tr');
            tr.innerHTML = row;
            tr.childNodes[0].addEventListener('click', projectClick);
            tbody.appendChild(tr);
        }
    });
}

function getFiles() {
    let tbody = $('tbody')[0];
    tbody.innerHTML = '';
    getData(`/api/project/${PROJECTID}/file`).then((data) => {
        for (let i in data) {
            let p = data[i];
            console.log(p);
            let row =
            `<td>${i}</td>
             <td id=${i}>${p.name}</td>
             <td>文本数 ${p.linesCount} 段 | 已翻译 ${p.transCount} 段 | 已锁定 ${p.locksCount} 段 | 完成度 ${(p.transCount/p.linesCount*100).toFixed(2)}% </td>`;
            let tr = document.createElement('tr');
            tr.innerHTML = row;
            tr.childNodes[0].addEventListener('click', fileClick);
            tbody.appendChild(tr);
        }
    });
}

getProjects();

