export interface LogMessage {
	id: string;
	timestamp: number;
	type: 'info' | 'success' | 'warning' | 'error';
	content: string;
}
