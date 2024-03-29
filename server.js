const http = require('http');
const { serve } = require('js-serve');
const { join } = require('path');
const EventEmitter = require('events');
const SocketServer = require('js-sockets');

Function.prototype.inherits = function(superclass) {
	this.prototype = Object.create(superclass.prototype);
	this.prototype.constructor = superclass;
	this.super = function(...args) {
		superclass.call(this, ...args);
		const _super = {};
		for (const key in superclass.prototype) {
			_super[key] = superclass.prototype[key];
			if (typeof _super[key] === 'function')
				_super[key] = _super[key].bind(this);
		}
		return _super;
	};
};


// server, path
// port, path
// port
PeerServer.inherits(EventEmitter);
function PeerServer(server, path='/peers') {
	if (!(this instanceof PeerServer)) return new PeerServer(...arguments);
	PeerServer.super.call(this);

	let port;
	if (typeof server == 'number') {
		port = server;
		server = http.createServer();
	}

	const io = new SocketServer(server);
	io.on('listening', (...args)=>this.emit('listening', ...args));
	typeof port == 'number' && server.listen(port);
	serve(
		{
			path: '/js-peers/client.js',
			file: join(__dirname, 'client.js'),
			headers: { 'Content-Type': 'text/javascript' }
		},
		server
	);

	const onRequest = (socketId, peerId, allow, deny) => {
		const status = request[socketId + peerId];
		if (status === 'sent' || status === 'blocked') {
			delete request[socketId + peerId];
		} else {
			allow();
		}
	};
	this.on('request', onRequest);
	this.on('newListener', (event) => {
		if (event === 'request') {
			this.off('request', onRequest);
			this.on('request', onRequest);
		}
	});

	const sockets = {};
	const request = {};
	io.in(path.replace(/^\/?/, '/')).on('connection', (socket) => {
		this.emit('connection', socket);
		console.log('connection');

		sockets[socket.id] = socket;
		socket.emit('connection', socket.id);

		socket.on('request', (peerId) => {
			this.emit(
				'request',
				socket.id,
				peerId,
				() => {
					request[socket.id + peerId] = 'sent';
					sockets[peerId].emit('request', socket.id);
				},
				() => {
					request[socket.id + peerId] = 'blocked';
					sockets[socket.id].emit('deny', peerId);
				}
			);
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

		socket.on('disconnect', () => {
			this.emit('disconnect', socket);
			delete sockets[socket.id];
		});
	});
}

module.exports = PeerServer;
module.exports.PeerServer = PeerServer;
module.exports.PeerConnection = require('./node-client');;
