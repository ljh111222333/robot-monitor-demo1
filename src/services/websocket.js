import { performance } from 'node:perf_hooks';
import { WebSocket, WebSocketServer } from 'ws';
import {
	addClient,
	cacheDeviceJointState,
	connectDevice,
	createSimulatedJointState,
	disconnectDevice,
	getDevice,
	getDeviceSnapshots,
	getDeviceSubscriberCount,
	getDeviceSubscribers,
	getJointDefinitions,
	getSimulationFrequencyHz,
	removeClient,
	subscribeClientToDevice,
	unsubscribeClient,
} from './store.js';

const HEARTBEAT_CHECK_INTERVAL_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 30_000;
const MAX_BUFFERED_BYTES = 1024 * 1024;

export function createWebSocketService(server) {
	const wss = new WebSocketServer({ server });
	const simulationSchedules = new Map();
	let heartbeatTimer = null;

	function sendJson(ws, message) {
		if (ws.readyState !== WebSocket.OPEN) return false;
		ws.send(JSON.stringify(message));
		return true;
	}

	function sendError(ws, code, message) {
		sendJson(ws, {
			type: 'error',
			data: { code, message, timestamp: Date.now() },
		});
	}

	// 实时关节帧只发送给当前订阅该设备的客户端；慢客户端直接跳过旧帧。
	function sendJointStateToSubscribers(deviceId, frame) {
		const messageText = JSON.stringify({ type: 'joint_state', data: frame });
		for (const client of getDeviceSubscribers(deviceId)) {
			if (
				client.ws.readyState === WebSocket.OPEN &&
				client.ws.bufferedAmount < MAX_BUFFERED_BYTES
			) {
				client.ws.send(messageText);
			}
		}
	}

	function attachClientConnection(ws, requestUrl, remoteAddress) {
		const client = addClient(
			ws,
			remoteAddress,
			requestUrl.searchParams.get('name'),
		);
		console.log(`客户端 ${client.id} 已连接`);

		sendJson(ws, {
			type: 'connection',
			data: {
				role: 'client',
				clientId: client.id,
				timestamp: Date.now(),
			},
		});
		sendJson(ws, {
			type: 'device_list',
			data: { devices: getDeviceSnapshots() },
		});

		ws.on('message', (rawData) => {
			try {
				const message = JSON.parse(rawData.toString());
				if (message.type === 'subscribe_device') {
					const deviceId = message.data?.deviceId;
					if (typeof deviceId !== 'string' || !getDevice(deviceId)) {
						sendError(ws, 'DEVICE_NOT_FOUND', `设备 ${deviceId ?? ''} 不存在`);
						return;
					}

					const transition = subscribeClientToDevice(client.id, deviceId);
					if (transition.deactivatedDeviceId) {
						stopSimulatedDeviceIfIdle(transition.deactivatedDeviceId);
					}
					sendJson(ws, {
						type: 'subscription_changed',
						data: transition.subscription,
					});

					if (
						transition.activatedDeviceId &&
						startSimulatedDeviceChannel(transition.activatedDeviceId)
					) {
						return;
					}

					// 已存在的频道复用缓存帧，新订阅者无需等待下一个采样周期。
					const latestFrame = getDevice(deviceId)?.latestFrame;
					if (latestFrame) {
						sendJson(ws, { type: 'joint_state', data: latestFrame });
					}
					return;
				}

				if (message.type === 'unsubscribe_device') {
					const transition = unsubscribeClient(client.id);
					sendJson(ws, {
						type: 'subscription_changed',
						data: transition.subscription,
					});
					if (transition.deactivatedDeviceId) {
						stopSimulatedDeviceIfIdle(transition.deactivatedDeviceId);
					}
					return;
				}

				sendError(
					ws,
					'UNKNOWN_CLIENT_MESSAGE',
					`客户端消息类型 ${message.type ?? ''} 不受支持`,
				);
			} catch (error) {
				console.error(`客户端 ${client.id} 消息处理失败:`, error);
				sendError(ws, 'INVALID_CLIENT_MESSAGE', error.message);
			}
		});

		ws.on('close', () => {
			const result = removeClient(client.id);
			if (result?.deactivatedDeviceId) {
				stopSimulatedDeviceIfIdle(result.deactivatedDeviceId);
			}
			console.log(`客户端 ${client.id} 已断开`);
		});
	}

	function attachDeviceConnection(ws, requestUrl, remoteAddress) {
		const deviceId = requestUrl.searchParams.get('deviceId');
		if (!deviceId) {
			sendError(ws, 'DEVICE_ID_REQUIRED', '设备连接必须提供 deviceId');
			ws.close(1008, 'deviceId required');
			return;
		}

		const previousConnection = getDevice(deviceId)?.ws;
		if (
			previousConnection &&
			previousConnection !== ws &&
			previousConnection.readyState === WebSocket.OPEN
		) {
			previousConnection.close(4001, 'device reconnected');
		}

		let device;
		try {
			device = connectDevice({
				id: deviceId,
				name: requestUrl.searchParams.get('name'),
				ws,
				remoteAddress,
			});
		} catch (error) {
			sendError(ws, 'DEVICE_CONNECTION_REJECTED', error.message);
			ws.close(1008, 'device rejected');
			return;
		}

		console.log(`设备 ${device.id} 已连接`);
		sendJson(ws, {
			type: 'connection',
			data: {
				role: 'device',
				deviceId: device.id,
				joints: getJointDefinitions(),
				timestamp: Date.now(),
			},
		});

		ws.on('message', (rawData) => {
			try {
				const message = JSON.parse(rawData.toString());
				if (message.type !== 'joint_state') {
					sendError(
						ws,
						'UNKNOWN_DEVICE_MESSAGE',
						`设备消息类型 ${message.type ?? ''} 不受支持`,
					);
					return;
				}

				// 同 ID 新连接接管后，拒绝旧连接迟到的数据。
				if (getDevice(device.id)?.ws !== ws) return;
				const frame = cacheDeviceJointState(device.id, message.data);
				sendJointStateToSubscribers(device.id, frame);
			} catch (error) {
				console.error(`设备 ${device.id} 数据处理失败:`, error);
				sendError(ws, 'INVALID_JOINT_STATE', error.message);
			}
		});

		ws.on('close', () => {
			const result = disconnectDevice(device.id, ws);
			if (result) {
				for (const client of result.subscribers) {
					sendJson(client.ws, {
						type: 'device_unavailable',
						data: { deviceId: device.id, timestamp: Date.now() },
					});
				}
				console.log(`设备 ${device.id} 已断开`);
			}
		});
	}

	wss.on('connection', (ws, request) => {
		const requestUrl = new URL(request.url ?? '/', 'http://localhost');
		const role = requestUrl.searchParams.get('role') ?? 'client';
		ws.lastPongAt = Date.now();
		ws.on('pong', () => {
			ws.lastPongAt = Date.now();
		});
		ws.on('error', (error) => {
			console.error(`WebSocket ${role} 连接错误:`, error);
		});

		if (role === 'client') {
			attachClientConnection(ws, requestUrl, request.socket.remoteAddress);
			return;
		}
		if (role === 'device') {
			attachDeviceConnection(ws, requestUrl, request.socket.remoteAddress);
			return;
		}

		sendError(ws, 'INVALID_ROLE', `未知连接角色 ${role}`);
		ws.close(1008, 'invalid role');
	});

	function scheduleSimulatedDevice(deviceId) {
		if (getDeviceSubscriberCount(deviceId) === 0) {
			simulationSchedules.delete(deviceId);
			return;
		}

		const frequencyHz = getSimulationFrequencyHz(deviceId);
		if (frequencyHz === null) return;

		const intervalMs = 1000 / frequencyHz;
		const now = performance.now();
		const schedule = simulationSchedules.get(deviceId) ?? {
			frequencyHz,
			nextFrameAt: now + intervalMs,
			timer: null,
		};

		if (
			schedule.frequencyHz !== frequencyHz ||
			schedule.nextFrameAt < now - intervalMs
		) {
			schedule.frequencyHz = frequencyHz;
			schedule.nextFrameAt = now + intervalMs;
		} else if (simulationSchedules.has(deviceId)) {
			schedule.nextFrameAt += intervalMs;
		}

		schedule.timer = setTimeout(() => {
			if (getDeviceSubscriberCount(deviceId) === 0) {
				simulationSchedules.delete(deviceId);
				return;
			}
			const frame = createSimulatedJointState(deviceId);
			sendJointStateToSubscribers(deviceId, frame);
			scheduleSimulatedDevice(deviceId);
		}, Math.max(0, schedule.nextFrameAt - now));
		simulationSchedules.set(deviceId, schedule);
	}

	function startSimulatedDeviceChannel(deviceId) {
		if (
			getSimulationFrequencyHz(deviceId) === null ||
			simulationSchedules.has(deviceId)
		) {
			return false;
		}

		// 频道从零订阅变为活跃时生成新帧，避免把停机前的缓存状态发给首个订阅者。
		const frame = createSimulatedJointState(deviceId);
		sendJointStateToSubscribers(deviceId, frame);
		scheduleSimulatedDevice(deviceId);
		return true;
	}

	function stopSimulatedDeviceIfIdle(deviceId) {
		if (getDeviceSubscriberCount(deviceId) > 0) return;

		const schedule = simulationSchedules.get(deviceId);
		if (!schedule) return;
		clearTimeout(schedule.timer);
		simulationSchedules.delete(deviceId);
	}

	function startBackgroundTasks() {
		if (!heartbeatTimer) {
			heartbeatTimer = setInterval(() => {
				const now = Date.now();
				for (const ws of wss.clients) {
					if (now - ws.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
						ws.terminate();
						continue;
					}
					if (ws.readyState === WebSocket.OPEN) ws.ping();
				}
			}, HEARTBEAT_CHECK_INTERVAL_MS);
		}
	}

	function stopBackgroundTasks() {
		clearInterval(heartbeatTimer);
		heartbeatTimer = null;
		for (const schedule of simulationSchedules.values()) {
			clearTimeout(schedule.timer);
		}
		simulationSchedules.clear();
	}

	if (server.listening) startBackgroundTasks();
	server.on('listening', startBackgroundTasks);
	server.on('close', stopBackgroundTasks);
	wss.on('close', stopBackgroundTasks);
	return wss;
}
