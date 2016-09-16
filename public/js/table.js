"use strict";
// jshint browser:true, devel: true


class MyTable {
    constructor() {
        let table = this.table = document.createElement('table');
        let thead = this.thead = document.createElement('thead');
        let tbody = this.tbody = document.createElement('tbody');
        table.appendChild(thead);
        table.appendChild(tbody);
    }

    setColumns(cols) {
        this.cols = cols;
        this.thead.innerHTML = '';
        let tr = document.createElement('tr');
        for (let col of cols) {
            let th = document.createElement('th');
            th.appendChild(document.createTextNode(col.name));
            tr.appendChild(th);
        }
        this.thead.appendChild(tr);
    }

    setData(data) {
        let cols = this.cols;
        let tbody = this.tbody;
        tbody.innerHTML = '';
        for (let row of data) {
            let tr = document.createElement('tr');
            for (let col of cols) {
                let td = document.createElement('td');
                let text = col.key[0] === '$' ? eval('`' + col.key + '`') : row[col.key];
                if (col.href) {
                    let a = document.createElement('a');
                    a.href = eval('`' + col.href + '`');
                    a.text = text;
                    td.appendChild(a);
                } else {
                    td.appendChild(document.createTextNode(text));
                }
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
    }

    on(event, callback) {
        this.table.addEventListener(event, callback);
    }

    render() {
        return this.table;
    }
}
