// 为了避免ws和组件深度绑定，使用store来实现全局单例连接

import { SocketServer } from '@/core/SocketServer';
import { useLogStore } from './logStore';
import type { LoadingInstance } from 'element-plus';

export const useWebSocketStore = defineStore('webSocke', () => {
	let wsServer: SocketServer | null = null;
	let loading: LoadingInstance | null = null;
	const loadintStatus = ref<number>(-1); // -1: 未连接, 0: 连接失败, 1: 连接成功, 2: 连接中

	// 获取实例
	const getWsSocket = () => {
		if (!wsServer) {
			initSocket();
		}

		return wsServer;
	};

	// 初始化WebSocket
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

		wsServer.on('connecting', (data) => {
			console.log('connecting', data.url);
			loading = ElLoading.service({
				text: '设备连接中...',
				lock: true,
				background: 'rgba(0, 0, 0, 0.5)',
			});
			loadintStatus.value = 2;
		});
		wsServer.on('connected', (data) => {
			console.log('connected', data.clientInfo);
			loading?.close();
			ElMessage({
				message: '设备连接成功',
				type: 'success',
			});
			loadintStatus.value = 1;
		});
		wsServer.on('reconnect', () => {
			console.log('reconnect');
			loading?.close();
			ElMessage({
				message: '重连成功',
				type: 'success',
			});
			loadintStatus.value = 1;
		});
		wsServer.on('reconnect_error', (error) => {
			console.error('reconnect_error', error);
		});
		wsServer.on('reconnect_failed', (data) => {
			console.error('reconnect_failed', data.reason);
			loading?.close();
			ElMessage({
				message: '重连失败，请检查网络后重试',
				type: 'error',
			});
			loadintStatus.value = 0;
		});
	};

	const closeConnectingLoading = () => {
		loading?.close();
		loading = null;
	};
	return {
		loadintStatus,
		getWsSocket,
		closeConnectingLoading,
	};
});
