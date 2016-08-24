
let tbody = $('tbody');

getData('/api/project/0/file').then((data) => {
    for (let files of data) {
        console.log(proj);
    }
});
