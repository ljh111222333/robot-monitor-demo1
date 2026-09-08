import { ref } from 'vue';

export const useWebSocket = () => {
	const ws = ref<WebSocket | null>(null);
	const isConnected = computed(() => ws.value?.readyState === WebSocket.OPEN);

	// 发起连接
	const connect = (url: string) => {
		if (isConnected.value) return console.log('WebSocket already connected');

		ws.value = new WebSocket(url);
		ws.value.onopen = () => {
			console.log('WebSocket connected');
		};
		ws.value.onmessage = (event) => {
			console.log('WebSocket message', event.data);
		};
		ws.value.onclose = () => {
			console.log('WebSocket disconnected');
		};
	};

	const disconnect = () => {
		ws.value?.close();
	};
	return {
		connect,
		disconnect,
		ws,
		isConnected,
	};
};
