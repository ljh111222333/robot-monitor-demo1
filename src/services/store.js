import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MIN_SIMULATION_FREQUENCY_HZ = 10;
export const MAX_SIMULATION_FREQUENCY_HZ = 40;
export const DEFAULT_SIMULATION_FREQUENCY_HZ = 20;
export const DEFAULT_SIMULATED_DEVICE_ID = 'ur5-simulator-1';

const URDF_PATH = fileURLToPath(
	new URL('../../public/robots_asset/ur5_pybullet.urdf', import.meta.url),
);

function readXmlAttribute(source, attributeName) {
	const match = source.match(
		new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`),
	);
	return match?.[1];
}

function loadJointDefinitions() {
	const urdf = readFileSync(URDF_PATH, 'utf8');
	const definitions = [];
	const jointPattern = /<joint\s+([^>]+)>([\s\S]*?)<\/joint>/g;

	for (const match of urdf.matchAll(jointPattern)) {
		const [, jointAttributes, jointBody] = match;
		const type = readXmlAttribute(jointAttributes, 'type');
		if (type !== 'revolute' && type !== 'continuous') continue;

		const name = readXmlAttribute(jointAttributes, 'name');
		const limitAttributes = jointBody.match(/<limit\s+([^>]+)\/?\s*>/)?.[1];
		if (!name || !limitAttributes) {
			throw new Error('URDF 中存在缺少名称或 limit 的可动关节');
		}

		const lower = Number(readXmlAttribute(limitAttributes, 'lower') ?? -Math.PI);
		const upper = Number(readXmlAttribute(limitAttributes, 'upper') ?? Math.PI);
		const maxVelocity = Number(readXmlAttribute(limitAttributes, 'velocity'));
		if (![lower, upper, maxVelocity].every(Number.isFinite)) {
			throw new Error(`URDF 关节 ${name} 的 limit 配置无效`);
		}

		definitions.push(
			Object.freeze({
				name,
				type,
				minRad: lower,
				maxRad: upper,
				maxVelocityRadPerSecond: maxVelocity,
			}),
		);
	}

	if (definitions.length === 0) {
		throw new Error('URDF 中没有可用于模拟的 revolute 或 continuous 关节');
	}
	return Object.freeze(definitions);
}

const jointDefinitions = loadJointDefinitions();
const jointDefinitionsByName = new Map(
	jointDefinitions.map((joint) => [joint.name, joint]),
);
const clients = new Map();
const devices = new Map();
// deviceId 同时作为频道 ID；每个频道只保存真实订阅它的客户端。
const subscribersByDevice = new Map();
let clientIdCounter = 0;

function createSimulatedDevice() {
	const now = Date.now();
	return {
		id: DEFAULT_SIMULATED_DEVICE_ID,
		name: 'UR5 内置模拟设备',
		source: 'simulator',
		status: 'online',
		connectedAt: now,
		lastSeenAt: now,
		latestFrame: null,
		sequence: 0,
		simulation: {
			frequencyHz: DEFAULT_SIMULATION_FREQUENCY_HZ,
			startedAt: now,
		},
	};
}

devices.set(DEFAULT_SIMULATED_DEVICE_ID, createSimulatedDevice());

export function addClient(ws, remoteAddress, name) {
	const clientId = ++clientIdCounter;
	const client = {
		id: clientId,
		ws,
		name: name || `客户端${clientId}`,
		remoteAddress,
		connectedAt: Date.now(),
		subscribedDeviceId: null,
	};
	clients.set(clientId, client);
	return client;
}

function removeClientFromChannel(client) {
	const previousDeviceId = client.subscribedDeviceId;
	if (!previousDeviceId) return null;

	const subscribers = subscribersByDevice.get(previousDeviceId);
	subscribers?.delete(client);
	client.subscribedDeviceId = null;
	if (!subscribers || subscribers.size > 0) return null;

	subscribersByDevice.delete(previousDeviceId);
	return previousDeviceId;
}

export function removeClient(clientId) {
	const client = clients.get(clientId);
	if (!client) return null;

	const deactivatedDeviceId = removeClientFromChannel(client);
	clients.delete(clientId);
	return { clientId, deactivatedDeviceId };
}

export function subscribeClientToDevice(clientId, deviceId) {
	const client = clients.get(clientId);
	if (!client || !devices.has(deviceId)) return null;

	const subscribedAt = Date.now();
	if (client.subscribedDeviceId === deviceId) {
		return {
			subscription: {
				clientId,
				deviceId,
				channelId: deviceId,
				subscribedAt,
			},
			activatedDeviceId: null,
			deactivatedDeviceId: null,
		};
	}

	const deactivatedDeviceId = removeClientFromChannel(client);
	let subscribers = subscribersByDevice.get(deviceId);
	const activatedDeviceId = subscribers ? null : deviceId;
	if (!subscribers) {
		subscribers = new Set();
		subscribersByDevice.set(deviceId, subscribers);
	}
	subscribers.add(client);
	client.subscribedDeviceId = deviceId;

	return {
		subscription: {
			clientId,
			deviceId,
			channelId: deviceId,
			subscribedAt,
		},
		activatedDeviceId,
		deactivatedDeviceId,
	};
}

export function unsubscribeClient(clientId) {
	const client = clients.get(clientId);
	if (!client) return null;

	const previousDeviceId = client.subscribedDeviceId;
	const deactivatedDeviceId = removeClientFromChannel(client);
	return {
		subscription: {
			clientId,
			previousDeviceId,
			deviceId: null,
			channelId: null,
			subscribedAt: Date.now(),
		},
		deactivatedDeviceId,
	};
}

export function getDeviceSubscribers(deviceId) {
	return subscribersByDevice.get(deviceId) ?? [];
}

export function getDeviceSubscriberCount(deviceId) {
	return subscribersByDevice.get(deviceId)?.size ?? 0;
}

export function getClientSummaries() {
	return Array.from(clients.values()).map((client) => ({
		id: client.id,
		name: client.name,
		remoteAddress: client.remoteAddress,
		connectedAt: client.connectedAt,
		subscribedDeviceId: client.subscribedDeviceId,
		channelId: client.subscribedDeviceId,
	}));
}

export function connectDevice({ id, name, ws, remoteAddress }) {
	if (!id) throw new TypeError('设备连接缺少 deviceId');

	const existingDevice = devices.get(id);
	if (existingDevice?.source === 'simulator') {
		throw new Error(`设备 ID ${id} 已由内置模拟器使用`);
	}

	const now = Date.now();
	const device = {
		id,
		name: name || existingDevice?.name || id,
		source: 'websocket',
		status: 'online',
		remoteAddress,
		connectedAt: existingDevice?.connectedAt ?? now,
		lastSeenAt: now,
		latestFrame: existingDevice?.latestFrame ?? null,
		sequence: existingDevice?.sequence ?? 0,
		ws,
	};
	devices.set(id, device);
	return device;
}

// 旧连接关闭时只移除它自己，避免同 ID 设备重连后被迟到的 close 事件删除。
export function disconnectDevice(deviceId, ws) {
	const device = devices.get(deviceId);
	if (!device || device.source !== 'websocket' || device.ws !== ws) return null;

	const subscribers = subscribersByDevice.get(deviceId) ?? [];
	for (const client of subscribers) {
		client.subscribedDeviceId = null;
	}
	subscribersByDevice.delete(deviceId);
	devices.delete(deviceId);
	return { deviceId, subscribers };
}

export function getDevice(deviceId) {
	return devices.get(deviceId);
}

function toDeviceSnapshot(device) {
	return {
		id: device.id,
		name: device.name,
		source: device.source,
		status: device.status,
		connectedAt: device.connectedAt,
		lastSeenAt: device.lastSeenAt,
		subscriberCount: getDeviceSubscriberCount(device.id),
		simulationFrequencyHz: device.simulation?.frequencyHz ?? null,
		latestFrame: device.latestFrame,
	};
}

export function getDeviceSnapshot(deviceId) {
	const device = devices.get(deviceId);
	return device ? toDeviceSnapshot(device) : null;
}

export function getDeviceSnapshots() {
	return Array.from(devices.values(), toDeviceSnapshot);
}

export function getJointDefinitions() {
	return jointDefinitions;
}

function normalizeJointValues(values, fieldName, required) {
	if (values === undefined && !required) return {};
	if (!values || typeof values !== 'object' || Array.isArray(values)) {
		throw new TypeError(`${fieldName} 必须是关节名称到数值的对象`);
	}

	const normalized = {};
	for (const joint of jointDefinitions) {
		const value = values[joint.name];
		if (value === undefined) {
			if (required) throw new TypeError(`${fieldName} 缺少关节 ${joint.name}`);
			continue;
		}
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			throw new TypeError(`${fieldName}.${joint.name} 必须是有限数字`);
		}
		if (
			fieldName === 'positions' &&
			(value < joint.minRad || value > joint.maxRad)
		) {
			throw new RangeError(`${fieldName}.${joint.name} 超出 URDF 关节限位`);
		}
		if (
			fieldName === 'velocities' &&
			Math.abs(value) > joint.maxVelocityRadPerSecond
		) {
			throw new RangeError(`${fieldName}.${joint.name} 超出 URDF 速度限位`);
		}
		normalized[joint.name] = value;
	}

	for (const jointName of Object.keys(values)) {
		if (!jointDefinitionsByName.has(jointName)) {
			throw new TypeError(`${fieldName} 包含未知关节 ${jointName}`);
		}
	}
	return normalized;
}

export function cacheDeviceJointState(deviceId, data) {
	const device = devices.get(deviceId);
	if (!device) throw new Error(`设备 ${deviceId} 不存在`);
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		throw new TypeError('joint_state.data 必须是对象');
	}

	const receivedAt = Date.now();
	const frame = {
		deviceId,
		sequence: ++device.sequence,
		timestamp: Number.isFinite(data.timestamp) ? data.timestamp : receivedAt,
		receivedAt,
		frequencyHz:
			typeof data.frequencyHz === 'number' && Number.isFinite(data.frequencyHz)
				? data.frequencyHz
				: null,
		positions: normalizeJointValues(data.positions, 'positions', true),
		velocities: normalizeJointValues(data.velocities, 'velocities', false),
	};
	device.latestFrame = frame;
	device.lastSeenAt = receivedAt;
	device.status = 'online';
	return frame;
}

export function getSimulationFrequencyHz(deviceId) {
	return devices.get(deviceId)?.simulation?.frequencyHz ?? null;
}

export function setSimulationFrequencyHz(deviceId, frequencyHz) {
	const device = devices.get(deviceId);
	if (!device || !device.simulation) return null;
	if (
		typeof frequencyHz !== 'number' ||
		!Number.isFinite(frequencyHz) ||
		frequencyHz < MIN_SIMULATION_FREQUENCY_HZ ||
		frequencyHz > MAX_SIMULATION_FREQUENCY_HZ
	) {
		throw new RangeError(
			`frequencyHz 必须是 ${MIN_SIMULATION_FREQUENCY_HZ} 到 ${MAX_SIMULATION_FREQUENCY_HZ} 之间的数字`,
		);
	}

	device.simulation.frequencyHz = frequencyHz;
	return getDeviceSnapshot(deviceId);
}

// 内置模拟设备与真实设备共用 cacheDeviceJointState，确保订阅者收到相同的数据契约。
export function createSimulatedJointState(deviceId, timestamp = Date.now()) {
	const device = devices.get(deviceId);
	if (!device?.simulation) throw new Error(`设备 ${deviceId} 不是模拟设备`);

	const elapsedSeconds = (timestamp - device.simulation.startedAt) / 1000;
	const positions = {};
	const velocities = {};
	jointDefinitions.forEach((joint, index) => {
		const periodSeconds = 16 + index * 2;
		const angularFrequency = (Math.PI * 2) / periodSeconds;
		const center = (joint.minRad + joint.maxRad) / 2;
		const rangeLimitedAmplitude = (joint.maxRad - joint.minRad) * 0.35;
		const velocityLimitedAmplitude =
			(joint.maxVelocityRadPerSecond * 0.8) / angularFrequency;
		const amplitude = Math.min(
			rangeLimitedAmplitude,
			velocityLimitedAmplitude,
		);
		const progress =
			angularFrequency * elapsedSeconds + index * (Math.PI / 3);
		positions[joint.name] = Number(
			(center + amplitude * Math.sin(progress)).toFixed(6),
		);
		velocities[joint.name] = Number(
			(amplitude * angularFrequency * Math.cos(progress)).toFixed(6),
		);
	});

	return cacheDeviceJointState(deviceId, {
		timestamp,
		frequencyHz: device.simulation.frequencyHz,
		positions,
		velocities,
	});
}

export function getServerSnapshot() {
	return {
		clients: getClientSummaries(),
		devices: getDeviceSnapshots(),
		jointDefinitions,
		frequencyRangeHz: {
			min: MIN_SIMULATION_FREQUENCY_HZ,
			max: MAX_SIMULATION_FREQUENCY_HZ,
		},
	};
}
