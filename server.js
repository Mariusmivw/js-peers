function main(app) {
	const { EventEmitter } = require('events');
	const emitter = new EventEmitter();
	const io = require('socket.io')(app);
	var evs = app.listeners('request').slice(0);
	app.removeAllListeners('request');
	app.on('request', (req, res) => {
		if (require('url').parse(req.url).pathname === '/js-peers/client.js') {
			res.setHeader('Content-Type', 'text/javascript');
			res.write(require('fs').readFileSync(require('path').join(__dirname, 'client.js')));
			res.end();
		} else {
			for (var i = 0; i < evs.length; i++) {
				evs[i].call(app, req, res);
			}
		}
	});
	const sockets = {};
	const request = {};
	const onRequest = (socketId, peerId, allow, deny) => {
		const status = request[socketId + peerId];
		if (status === 'sent' || status === 'blocked') {
			delete request[socketId + peerId];
		} else {
			allow();
		}
	};
	emitter.on('request', onRequest);
	emitter.on('newListener', (event, listener) => {
		if (event === 'request') {
			emitter.off('request', onRequest);
			emitter.on('request', onRequest);
		}
	});
	io.of('/peer').on('connection', (socket) => {
		emitter.emit('connection', socket);
		console.log('connection')

		sockets[socket.id] = socket;
		socket.emit('connection', socket.id);

		socket.on('request', (peerId) => {
			emitter.emit('request', socket.id, peerId, () => {
				request[socket.id + peerId] = 'sent';
				sockets[peerId].emit('request', socket.id);
			}, () => {
				request[socket.id + peerId] = 'blocked';
				sockets[socket.id].emit('deny', peerId);
			});
		});
		socket.on('accept', (peerId) => {
			sockets[peerId].emit('accept', socket.id);
		});
		socket.on('deny', (peerId) => {
			sockets[peerId].emit('deny', socket.id);
		});
		socket.on('candidate', (candidate) => {
			sockets[socket.peerId].emit('candidate', candidate);
		});
		socket.on('offer', (peerId, desc) => {
			socket.peerId = peerId;
			sockets[peerId].emit('offer', socket.id, desc);
		});
		socket.on('answer', (peerId, desc) => {
			socket.peerId = peerId;
			sockets[peerId].emit('answer', socket.id, desc);
		});

		socket.on('disconnect', (reason) => {
			delete sockets[socket.id];
		});
	});
	return emitter;
}

module.exports = main;