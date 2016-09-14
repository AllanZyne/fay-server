
var bcrypt = dcodeIO.bcrypt;



$('form').addEventListener('submit', function(event) {
    event.preventDefault();
    console.log('submit');
    let data = new FormData(this),
        username = data.get('username');
        password = data.get('password');
    // let salt = bcrypt.genSaltSync(10);
    // let hash = bcrypt.hashSync(password, salt);
    getData('http://allan-pc:3000/api/authenticate', {
        username: username,
        password: password
    }).then(data => {
        console.log('[login] data', data);
        if (data.token) {
            window.location.search = `?token=${data.token}`;
        } else {
            if (data.message.match('username')) {
                $('#username').classList.add('invalid');
                $('#password').classList.remove('invalid');
            } else if (data.message.match('password')) {
                $('#password').classList.add('invalid');
                $('#username').classList.remove('invalid');
            }
        }
    }).catch(err => console.log('[login] error', err));
});

