!(function(t, e) {
	'object' == typeof exports && 'object' == typeof module
		? (module.exports = e())
		: 'function' == typeof define && define.amd
		? define([], e)
		: 'object' == typeof exports
		? (exports.PeerConnection = e())
		: (t.PeerConnection = e());
})(this, function() {
	// if (typeof io !== 'function') {
	// 	const script = document.createElement('script');
	// 	script.src = '/socket.io/socket.io.js';
	// 	// script.async = true;
	// 	// script.addEventListener('load', construct);
	// 	console.log(document.currentScript)
	// 	document.head.insertBefore(script, document.currentScript.nextElementSibling);
	// }
	class EventEmitter {
		constructor() {
			this._listeners = {};
			this._once_listeners = {};
			this.on = this.addEventListener = this.addListener;
			this.off = this.removeListener;
		}

		addListener(event, listener) {
			if (event !== undefined) {
				// this.emit('newListener', event, listener);
				this._listeners[event] = this._listeners[event] || [];
				this._listeners[event].push(listener);
			}
			return this;
		}

		once(event, listener) {
			if (event !== undefined) {
				// this.emit('newListener', event, listener);
				this._once_listeners[event] = this._once_listeners[event] || [];
				this._once_listeners[event].push(listener);
			}
			return this;
		}

		removeListener(event, listener) {
			if (event !== undefined) {
				let listeners;
				if ((listeners = this._listeners[event])) {
					const index = listeners[event].indexOf(listener);
					if (index > -1) {
						// this.emit('removeListener', event, listener);
						listeners[event].splice(index, 1);
					}
				}
			}
			return this;
		}

		removeAllListeners(event) {
			if (event !== undefined) {
				for (const listener of this.listeners(event)) {
					// this.emit('removeListener', event, listener);
				}
				this._listeners[event] = [];
				this._once_listeners[event] = [];
			} else {
				for (const event of [].concat(
					Object.keys(this._listeners),
					Object.keys(this._once_listeners)
				)) {
					this.removeAllListeners(event);
				}
			}
			return this;
		}

		listeners(event) {
			return [].concat(
				this._listeners[event] || [],
				this._once_listeners[event] || []
			);
		}

		emit(event, ...args) {
			if (event !== undefined) {
				const listeners = this.listeners(event);
				if (listeners.length) {
					for (const listener of listeners) {
						listener.apply(this, args);
					}
					if (this._once_listeners[event]) {
						for (const listener of this._once_listeners[event]) {
							// this.emit('removeListener', listener);
						}
					}
					this._once_listeners[event] = [];
					return true;
				}
			}
			return false;
		}

		static listenerCount(emitter, event) {
			if (emitter && event !== undefined) {
				return emitter.listeners(event).length;
			}
			return null;
		}
	}

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
			const construct = () => {
				if (Array.isArray(path)) {
					args = path;
					port = parseInt(location.port);
					server = location.hostname;
					path = '/';
				} else if (typeof server == 'undefined') {
					server = location.hostname;
					port = parseInt(location.port);
				} else if (Array.isArray(server)) {
					args = server;
					port = parseInt(location.port);
					server = location.hostname;
				} else if (typeof server == 'number') {
					if (Array.isArray(port)) {
						args = port;
					}
					port = server;
					server = location.hostname;
				} else if (typeof port == 'undefined') {
					port = parseInt(location.port);
				} else if (Array.isArray(port)) {
					args = port;
					port = parseInt(location.port);
				}
				if (typeof port == 'number') {
					port = `:${port}`;
				}
				if (typeof args == 'undefined') {
					args = [];
				}
				server.replace(/\/$/, '');
				path.replace(/^\/?/, '/');
				const pc = (this._peerConnection = new RTCPeerConnection(
					...args
				));
				const socket = (this._socket = new Socket(
					server + port + path
				));

				this.dataChannel = pc.createDataChannel('dataChannel');
				this.dataChannel.addEventListener('open', () => {
					console.log('channel opened');
					super.emit('open', this.dataChannel);
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
						() => {
							socket.emit('accept', peerId);
						},
						() => {
							socket.emit('deny', peerId);
						}
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
						pc.setLocalDescription(desc);
						socket.emit('offer', peerId, desc);
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
			};
			if (typeof io !== 'function') {
				const script = document.createElement('script');
				script.src = '/js-sockets/client.js';
				script.async = true;
				// script.onload = construct;
				script.addEventListener('load', construct);
				document.head.appendChild(script);
			} else {
				construct();
			}
		}

		emit(event, data) {
			this.dataChannel.send(JSON.stringify({ event, data }));
		}

		connect(peerId) {
			this._socket.emit('request', peerId);
		}
	}

	return PeerConnection;
});
