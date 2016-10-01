
$('form').addEventListener('submit', function(event) {
    event.preventDefault();
    // console.log('submit');
    let data = new FormData(this),
        username = data.get('email');
        password = data.get('password');
    $.get('/api/authenticate', {
        username: username,
        password: password
    }).then(data => {
        // console.log('[login] data', data);
        if (data) {
            if (data.message.match('username')) {
                $('#email').classList.add('invalid');
                $('#password').classList.remove('invalid');
            } else if (data.message.match('password')) {
                $('#password').classList.add('invalid');
                $('#email').classList.remove('invalid');
            }
        } else {
            window.location = '/';
        }
    }, err => {
        // console.log('[login] error', err);
    });
});
