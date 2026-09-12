import type { SuportLogType } from '@/stores/types/log';

export interface WebSocketMessage {
	type: string;
	data: any;
}

export interface ClientInfo {
	id?: number;
	type: string;
	name: string;
	connectedAt?: Date;
	lastHeartbeat?: number;
}

export interface JointControlData {
	jointName?: string;
	angle?: number;
	joints?: Array<{ name: string; angle: number }>;
	gripperOpenness?: number;
	duration?: number;
}

export type WebSocketEventHandler = (data: any) => void;

export interface SocketServerOptions {
	maxReconnectAttempts?: number;
	reconnectDelay?: number;
}

export type Logger = Record<SuportLogType, (...args: unknown[]) => void>;

export class SocketServer<I extends ClientInfo = ClientInfo> {
	private ws: WebSocket | null = null;
	private url: string = '';
	// 首次 connect 前没有客户端信息；不能用基础对象冒充可能含额外必填字段的 I。
	private clientInfo: I | null = null;
	private heartbeatInterval: number | null = null;
	private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
	private isConnected: boolean = false;
	private reconnectAttempts: number = 0;
	private options: SocketServerOptions = {
		maxReconnectAttempts: 3,
		reconnectDelay: 2000,
	};
	private isReconnecting: boolean = false;
	private isManualDisconnect: boolean = false;
	private log: Logger = {
		info: (args) => console.info(args),
		error: (args) => console.error(args),
		warning: (args) => console.warn(args),
		success: (args) => console.log(args),
	};

	constructor(options: SocketServerOptions = {}, log: Partial<Logger> = {}) {
		this.options = {
			reconnectDelay: options.reconnectDelay ?? this.options.maxReconnectAttempts,
			maxReconnectAttempts: options.maxReconnectAttempts ?? this.options.maxReconnectAttempts,
		};
		this.log = {
			info: log.info ?? this.log.info,
			error: log.error ?? this.log.error,
			warning: log.warning ?? this.log.warning,
			success: log.success ?? this.log.success,
		};
	}

	// 连接WebSocket
	async connect(url: string, clientInfo: I): Promise<void> {
		// 如果已有连接，先清理
		if (this.ws) {
			this.cleanupConnection();
		}

		this.url = url;
		this.clientInfo = clientInfo;

		return new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(this.url);
				this.emit('connecting', { url: this.url });
				console.log('WebSocket连接建立中...', this.url);

				this.ws.onopen = () => {
					this.log.success('WebSocket连接已建立');
					console.log('WebSocket连接已建立');
					this.isConnected = true;
					this.resetReconnectState();

					this.emit('connected', { clientInfo: this.clientInfo });
					resolve();
				};

				this.ws.onmessage = (event) => {
					try {
						const message: WebSocketMessage = JSON.parse(event.data);
						this.handleMessage(message);
					} catch (error) {
						this.log.error(`解析WebSocket消息失败: ${error}`);
						console.error('解析WebSocket消息失败:', error);
					}
				};

				this.ws.onclose = (event) => {
					this.log.warning(`WebSocket连接断开: ${event.code} ${event.reason}`);
					console.log('WebSocket连接已关闭:', event.code, event.reason);
					this.isConnected = false;

					// 重置重连标记，确保失败后可以继续下一次重连尝试
					this.isReconnecting = false;

					this.emit('disconnected', { code: event.code, reason: event.reason });

					// 如果不是手动断开且未达到最大重连次数，则尝试重连
					if (!this.isManualDisconnect && this.reconnectAttempts < this.options?.maxReconnectAttempts!) {
						this.attemptReconnect();
					} else if (this.reconnectAttempts >= this.options?.maxReconnectAttempts!) {
						this.log.error('已达到最大重连次数，停止重连');
						console.error('已达到最大重连次数，停止重连');
						this.emit('reconnect_failed', { attempts: this.reconnectAttempts, reason: '已达到最大重连次数' });
					}
				};

				this.ws.onerror = (error) => {
					this.log.error(`WebSocket错误: ${error}`);
					console.error('WebSocket连接错误:', error);
					this.emit('error', { error });
					reject(error);
				};
			} catch (error) {
				console.error('创建WebSocket连接失败:', error);
				reject(error);
			}
		});
	}

	// 断开连接
	disconnect(): void {
		this.isManualDisconnect = true;
		this.isReconnecting = false;
		this.cleanupConnection();
	}

	// 清理连接
	private cleanupConnection(): void {
		this.isConnected = false;

		if (this.ws) {
			// 如果连接还在打开状态，则关闭
			if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
				this.ws.close(1000, '客户端主动断开');
			}

			this.ws = null;
		}
	}

	// 发送消息
	send(type: string, data: any): void {
		if (!this.isConnected || !this.ws) {
			console.warn('WebSocket未连接，无法发送消息');
			return;
		}

		const message: WebSocketMessage = { type, data };

		try {
			this.ws.send(JSON.stringify(message));
		} catch (error) {
			this.log.error(`发送WebSocket消息失败: ${error}`);
			console.error('发送WebSocket消息失败:', error);
		}
	}

	// 处理接收到的消息
	private handleMessage(message: WebSocketMessage): void {
		switch (message.type) {
			case 'connection':
				if (this.clientInfo) {
					this.clientInfo.id = message.data.clientId;
				}
				break;

			case 'register_success':
				this.log.success(`客户端注册成功: ${JSON.stringify(message.data)}`);
				console.log('客户端注册成功:', message.data);
				break;

			case 'error':
				this.log.error(`服务器错误: ${JSON.stringify(message.data)}`);
				console.error('服务器错误:', message.data);
				break;
		}

		// 触发对应的事件处理器
		this.emit('message', message);
	}

	// 尝试重连
	private attemptReconnect(): void {
		if (this.isReconnecting || this.isManualDisconnect) return;

		this.isReconnecting = true;
		this.reconnectAttempts++;

		this.log.warning(`尝试WebSocket重连 (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);
		console.log(`尝试重连 (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})...`);

		setTimeout(() => {
			const clientInfo = this.clientInfo;
			if (!clientInfo) return;

			this.connect(this.url, clientInfo).catch((error) => {
				console.error(`重连失败:`, error);
				// 连接失败后，onclose事件会被触发，继续重连逻辑
			});
		}, this.options.reconnectDelay);
	}

	// 重置重连状态
	private resetReconnectState(): void {
		this.reconnectAttempts = 0;
		this.isManualDisconnect = false;
		this.isReconnecting = false;
	}

	// 事件监听
	on(event: string, handler: WebSocketEventHandler): () => void {
		if (!this.eventHandlers.has(event)) {
			this.eventHandlers.set(event, []);
		}
		this.eventHandlers.get(event)!.push(handler);

		// 返回当前事件的stop方法
		return () => {
			this.off(event, handler);
		};
	}

	// 单次触发
	once(event: string, handler: WebSocketEventHandler): void {
		const onceHandler = (data: any) => {
			handler(data);
			this.off(event, onceHandler);
		};
		this.on(event, onceHandler);
	}

	// 移除事件监听
	off(event: string, handler?: WebSocketEventHandler): void {
		if (!this.eventHandlers.has(event)) return;

		if (handler) {
			const handlers = this.eventHandlers.get(event)!;
			const index = handlers.indexOf(handler);
			if (index > -1) {
				handlers.splice(index, 1);
			}
		} else {
			this.eventHandlers.delete(event);
		}
	}

	// 触发事件
	private emit(event: string, data: any): void {
		const handlers = this.eventHandlers.get(event);
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(data);
				} catch (error) {
					this.log.error(`WebSocket事件处理器执行失败 (${event}): ${error}`);
					console.error(`事件处理器执行失败 (${event}):`, error);
				}
			});
		}
	}

	// 获取连接状态
	isWebSocketConnected(): boolean {
		return this.isConnected;
	}

	// 获取客户端信息；首次 connect 前返回 null。
	getClientInfo(): I | null {
		return this.clientInfo ? { ...this.clientInfo } : null;
	}

	// 手动重连（重置重连计数）
	async reconnect(): Promise<void> {
		const clientInfo = this.clientInfo;
		if (!clientInfo) {
			throw new Error('请先调用 connect(url, clientInfo) 初始化连接信息');
		}

		this.resetReconnectState();
		return this.connect(this.url, clientInfo);
	}
}
