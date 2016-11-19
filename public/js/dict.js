
document.addEventListener('mouseup', function(){
    let thetext = window.getSelection().toString();
    if (thetext.length > 0) {
        baiduFanYi(thetext);
    }
}, false);

function baiduFanYi(query) {
    return $.get('/api/translate', {
        q: query,
        from: 'jp',
        to: 'zh',
    }).then(results => {
        console.log('fanyi', results);
        let $fanyi = $('.fanyi');
        $fanyi.innerHTML = '';
        if ($fanyi) {
            for (let result of results) {
                $fanyi.innerHTML += `<div><span class="source">(${result.source}):</span>${result.result[0]}</div>`;
            }
            // $fanyi.textContent = result.trans_result[0].dst;
        }
    }).catch(err => {
        console.log('fanyi', err);
    });
}
