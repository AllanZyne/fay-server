
$('form').addEventListener('submit', function(event) {
    event.preventDefault();
    // console.log('submit');
    let data = new FormData(this),
        username = data.get('email');
        password = data.get('password');
    $.get('/api/login', {
        username: username,
        password: password
    }).then(_ => {
        window.location = '/';
    }).catch(err => {
        if (err.message.match('username')) {
            $('#email').classList.add('invalid');
            $('#password').classList.remove('invalid');
        } else if (err.message.match('password')) {
            $('#password').classList.add('invalid');
            $('#email').classList.remove('invalid');
        }
    });
});
