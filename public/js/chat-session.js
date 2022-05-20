var socket = io();

var messages = document.getElementById('messages');
var form = document.getElementById('form');
var input = document.getElementById('input');

// check active session
$.get('/activeChatSession', function (data) {
    if (data == "NoActiveSession") {
        console.log(data);
        //for testing
        window.location = '/';
    } else if (data == "InvalidUser") {
        console.log('invalid user');
        window.location = '/';
    } else {
        console.log(data);
        socket.emit('join-room', data.orderId)
        orderId = data.orderId;
        socket.on("chat message", (msg) => {
            var messagesContainer = $('#chatMessages');

            messagesContainer.append([
                '<li class="self">',
                newMessage,
                '</li>'
            ].join(''));
        });
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (input.value) {
                socket.emit('chat message', input.value, data.orderId);
                var item = document.createElement('li');
                item.textContent = input.value;
                messages.appendChild(item);
                input.value = '';
            }

        });

    }
})