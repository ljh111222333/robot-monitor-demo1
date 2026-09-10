// 为了避免ws和组件深度绑定，使用store来实现全局单例连接

import { SocketServer } from '@/core/SocketServer';
import { useLogStore } from './logStore';

export const useWebSocketStore = defineStore('webSocke', () => {
	let wsServer: SocketServer | null = null;

	// 获取实例
	const getWsSocket = () => {
		if (!wsServer) {
			initSocket();
		}

		return wsServer;
	};

	// 进行连接
	const initSocket = () => {
		const logStore = useLogStore();
		wsServer = new SocketServer(
			{},
			{
				info: (...args) => logStore.add('info', args[0] as string),
				error: (...args) => logStore.add('error', args[0] as string),
				warning: (...args) => logStore.add('warning', args[0] as string),
				success: (...args) => logStore.add('success', args[0] as string),
			},
		);
	};
	return {
		getWsSocket,
	};
});
