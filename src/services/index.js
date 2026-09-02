import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import {
	getClientSummaries,
	getDeviceSnapshot,
	getDeviceSnapshots,
	getJointDefinitions,
	getServerSnapshot,
	setSimulationFrequencyHz,
} from './store.js';
import { createWebSocketService } from './websocket.js';

const DEFAULT_PORT = 9900;

export const app = express();
export const server = createServer(app);
export const wss = createWebSocketService(server);

app.use(cors());
app.use(express.json());

app.get('/api/status', (_request, response) => {
	const snapshot = getServerSnapshot();
	response.json({
		status: 'running',
		clients: snapshot.clients.length,
		devices: snapshot.devices.length,
		uptime: process.uptime(),
		timestamp: Date.now(),
	});
});

app.get('/api/clients', (_request, response) => {
	response.json({ clients: getClientSummaries() });
});

app.get('/api/devices', (_request, response) => {
	response.json({
		devices: getDeviceSnapshots(),
		jointDefinitions: getJointDefinitions(),
	});
});

app.get('/api/devices/:deviceId', (request, response) => {
	const device = getDeviceSnapshot(request.params.deviceId);
	if (!device) {
		response.status(404).json({
			success: false,
			error: { code: 'DEVICE_NOT_FOUND', message: '设备不存在' },
		});
		return;
	}
	response.json({ device, jointDefinitions: getJointDefinitions() });
});

app.patch(
	'/api/devices/:deviceId/simulation/frequency',
	(request, response) => {
		const device = getDeviceSnapshot(request.params.deviceId);
		if (!device) {
			response.status(404).json({
				success: false,
				error: { code: 'DEVICE_NOT_FOUND', message: '设备不存在' },
			});
			return;
		}
		if (device.source !== 'simulator') {
			response.status(409).json({
				success: false,
				error: {
					code: 'NOT_SIMULATED_DEVICE',
					message: '只有内置模拟设备支持修改模拟频率',
				},
			});
			return;
		}

		try {
			const updatedDevice = setSimulationFrequencyHz(
				request.params.deviceId,
				request.body?.frequencyHz,
			);
			response.json({ success: true, device: updatedDevice });
		} catch (error) {
			if (error instanceof RangeError) {
				response.status(400).json({
					success: false,
					error: {
						code: 'INVALID_FREQUENCY',
						message: error.message,
					},
				});
				return;
			}
			throw error;
		}
	},
);

export function startServer(port = Number(process.env.PORT) || DEFAULT_PORT) {
	if (server.listening) return server;

	return server.listen(port, () => {
		const address = server.address();
		const listeningPort =
			typeof address === 'object' && address ? address.port : port;
		console.log(`微型服务器运行在端口 ${listeningPort}`);
		console.log(`客户端 WebSocket: ws://localhost:${listeningPort}?role=client`);
		console.log(
			`设备 WebSocket: ws://localhost:${listeningPort}?role=device&deviceId=<设备ID>`,
		);
		console.log(`REST API: http://localhost:${listeningPort}/api`);
	});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	startServer();
}
