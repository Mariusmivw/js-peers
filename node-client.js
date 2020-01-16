const EventEmitter = require('events');
const { Socket } = require('js-sockets');
const {
	RTCPeerConnection,
	RTCIceCandidate
} = require('./wrtc-prebuilt/wrtc');

/**
 *
 *
 * @class PeerConnection
 * @extends {EventEmitter}
 */
class PeerConnection extends EventEmitter {
	// path, server, port, args	=> string, string, number, object
	// path, server, port		=> string, string, number
	// path, server, args		=> string, string, object
	// path, server				=> string, string
	// path, port, args			=> string, number, object
	// path, port				=> string, number
	// path, args				=> string, object
	// path						=> string
	// args						=> object
	constructor(path, server, port, args) {
		super();
		if (Array.isArray(path)) {
			args = path;
			port = '';
			server = 'localhost';
			path = '/';
		} else if (typeof server == 'undefined') {
			server = 'localhost';
			port = '';
		} else if (Array.isArray(server)) {
			args = server;
			port = '';
			server = 'localhost';
		} else if (typeof server == 'number') {
			if (Array.isArray(port)) {
				args = port;
			}
			port = server;
			server = 'localhost';
		} else if (typeof port == 'undefined') {
			port = '';
		} else if (Array.isArray(port)) {
			args = port;
			port = '';
		}
		if (typeof port == 'number') {
			port = `:${port}`;
		}
		if (typeof args == 'undefined') {
			args = [];
		}
		server.replace(/\/$/, '');
		path.replace(/^\/?/, '/');
		const pc = (this._peerConnection = new RTCPeerConnection(...args));
		const socket = (this._socket = new Socket(
			server + port + path
		));

		this.dataChannel = pc.createDataChannel('dataChannel');
		this.dataChannel.addEventListener('open', () => {
			console.log('channel opened');
			super.emit('open');
		});
		pc.addEventListener('icecandidate', function({ candidate }) {
			if (!candidate) return;
			socket.emit('candidate', candidate);
		});
		pc.addEventListener('datachannel', (event) => {
			event.channel.addEventListener('message', (event) => {
				event = JSON.parse(event.data);
				console.log('received:', event);
				super.emit(event.event, ...event.data);
			});
		});

		socket.on('connection', (id) => {
			this.id = id;
			super.emit('ready');
		});
		socket.on('request', (peerId) => {
			super.emit(
				'request',
				peerId,
				() => socket.emit('accept', peerId),
				() => socket.emit('deny', peerId)
			);
		});
		function acceptor(peerId, accept, deny) {
			accept();
		}
		this.on('request', acceptor);
		this.on('newListener', (type) => {
			if (type == 'request') {
				this.off(type, acceptor);
				this.on(type, acceptor);
			}
		});
		socket.on('accept', (peerId) => {
			super.emit('accept', peerId);
			pc.createOffer().then((desc) => {
				pc.setLocalDescription(desc).then(() =>
					socket.emit('offer', peerId, desc)
				);
			});
		});
		socket.on('deny', (peerId) => {
			super.emit('deny', peerId);
		});
		socket.on('candidate', (candidate) => {
			console.log('got candidate');
			pc.addIceCandidate(new RTCIceCandidate(candidate))
				.then(() => console.log('added candidate'))
				.catch((e) => console.warn(e));
		});
		socket.on('offer', (peerId, desc) => {
			console.log('offer');
			console.log(desc);
			pc.setRemoteDescription(desc);
			pc.createAnswer().then((desc) => {
				pc.setLocalDescription(desc);
				socket.emit('answer', peerId, desc);
			});
		});
		socket.on('answer', (peerId, desc) => {
			console.log('answer');
			pc.setRemoteDescription(desc);
		});
	}

	emit(event, ...data) {
		this.dataChannel.send(JSON.stringify({ event, ...data }));
	}

	connect(peerId) {
		this._socket.emit('request', peerId);
	}
}

module.exports = PeerConnection;
