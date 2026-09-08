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

app.post('/api/joint/mode', (_request, response) => {
	console.log('mode change', _request.body);
	response.json({
		status: 1000,
		data: {
			mode: _request.body.mode === 'set' ? 'log' : 'set',
		},
		message: 'mode change success',
	});
});

export function startServer(port = Number(process.env.PORT) || DEFAULT_PORT) {
	if (server.listening) return server;

	return server.listen(port, () => {
		const address = server.address();
		const listeningPort = typeof address === 'object' && address ? address.port : port;
		console.log(`微型服务器运行在端口 ${listeningPort}`);
		console.log(`客户端 WebSocket: ws://localhost:${listeningPort}?role=client`);
		console.log(`设备 WebSocket: ws://localhost:${listeningPort}?role=device&deviceId=<设备ID>`);
		console.log(`REST API: http://localhost:${listeningPort}/api`);
	});
}

// console.log(process.argv[1]);
// console.log(fileURLToPath(import.meta.url));
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	startServer();
}
