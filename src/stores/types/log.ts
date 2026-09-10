export type SuportLogType = 'info' | 'error' | 'warning' | 'success';
export interface LogMessage {
	id: string;
	timestamp: number;
	type: SuportLogType;
	content: string;
}
