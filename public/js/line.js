
/*


!!!!

登陆流程！



*/




PROJECTID = 1;
FILEID = 1;




function lineClick(event) {
    console.log('lineClick');

    let oSpeeker = this.querySelector('.original .speeker').textContent,
        tSpeeker = this.querySelector('.translated .speeker').textContent,
        text = this.querySelector('.text').textContent,
        transtext = this.querySelector('.transtext').textContent;

    $('dialog.editor .original .speeker').textContent = oSpeeker;
    $('dialog.editor .translated .speeker').textContent = tSpeeker;
    $('dialog.editor .text').textContent = text;
    $('dialog.editor .transtext').textContent = transtext;

    location.hash = '#L' + this.dataset.line_number;
    this.classList.add('selected');
    // $('dialog.editor').showModal();
}

$('dialog.editor .close').addEventListener('click', function(event) {
    $('dialog.editor').close();
});


function getLines() {
    let article = $('article');
    article.innerHTML = '';
    getData(`/api/project/${PROJECTID}/file/${FILEID}/line`).then((data) => {
        for (let i in data) {
            let line = data[i];
            let texts = line.text.split('　');
            let transtext = '　';
            if (line.transtext) {
                let transtexts = line.transtext.split('　');
                if (transtexts.length == 2)
                    transtext = transtexts[1];
                else
                    transtext = line.transtext;
            }
// <a class="anchor" name="L${i}">&nbsp;</a>
            let content =
`
<div class="container">
  <div class="original">
    <div class="speeker">${texts.length == 2 ? texts[0] : ''}</div>
    <div class="text">${texts.length == 2 ? texts[1] : texts[0]}</div>
  </div>
  <div class="translated">
    <div class="speeker">${texts.length == 2 ? texts[0] : ''}</div>
    <div class="transtext">${transtext}</div>
  </div>
</div>`;
            let section = document.createElement('section');
            section.id = `LC${i}`;
            section.dataset.line_number = i;
            section.innerHTML = content;
            section.addEventListener('click', lineClick, true);

            let anchor = document.createElement('a');
            anchor.name = `L${i}`;
            anchor.className = 'anchor';
            anchor.textContent = ' ';
            article.appendChild(anchor);

            article.appendChild(section);
        }
    });
}

getLines();
