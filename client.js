!function (t, e) { "object" == typeof exports && "object" == typeof module ? module.exports = e() : "function" == typeof define && define.amd ? define([], e) : "object" == typeof exports ? exports.PeerConnection = e() : t.PeerConnection = e() }(this, function () {
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
				this._listeners[event] = (this._listeners[event] || []);
				this._listeners[event].push(listener);
			}
			return this;
		}

		once(event, listener) {
			if (event !== undefined) {
				// this.emit('newListener', event, listener);
				this._once_listeners[event] = (this._once_listeners[event] || []);
				this._once_listeners[event].push(listener);
			}
			return this;
		}

		removeListener(event, listener) {
			if (event !== undefined) {
				let listeners;
				if (listeners = this._listeners[event]) {
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
				for (const event of [].concat(Object.keys(this._listeners), Object.keys(this._once_listeners))) {
					this.removeAllListeners(event);
				}
			}
			return this;
		}

		listeners(event) {
			return [].concat(this._listeners[event] || [], this._once_listeners[event] || []);
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
		constructor(...args) {
			super();
			const construct = () => {
				const pc = this._peerConnection = new RTCPeerConnection(...args);
				const socket = this._socket = io(location.origin + '/peer');

				this.dataChannel = pc.createDataChannel('dataChannel');
				this.dataChannel.addEventListener('open', () => {
					console.log('channel opened');
				});
				pc.addEventListener('icecandidate', function (event) {
					if (event.candidate) {
						console.log(event.candidate);
						socket.emit('candidate', event.candidate);
					}
				});
				pc.addEventListener('datachannel', (event) => {
					event.channel.addEventListener('message', (event) => {
						event = JSON.parse(event.data);
						console.log("received:", event);
						super.emit(event.event, event.data);
					});
				});

				socket.on('connection', (id) => {
					this.id = id;
					super.emit('ready');
				});
				socket.on('request', (peerId) => {
					super.emit('request', peerId,
						() => {
							socket.emit('accept', peerId);
						}, () => {
							socket.emit('deny', peerId);
						}
					);
				});
				this.on('request', (peerId, accept, deny) => {
					if (this.listeners('request').length == 1) {
						accept();
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
					pc.addIceCandidate(new RTCIceCandidate({
						candidate: candidate.candidate,
						sdpMLineIndex: candidate.sdpMLineIndex
					}));
					console.log('added candidate');
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
			}
			if (typeof io !== 'function') {
				const script = document.createElement('script');
				script.src = '/socket.io/socket.io.js';
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