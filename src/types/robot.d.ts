export interface RobotInfo {
	id: string;
	name: string;
	description: string;
	status: 'online' | 'offline';
	connectedAt: number;
	lastSeenAt: number;
	latestFrame: any;
	simulationFrequencyHz: number;
	source: string;
	subscriberCount: number;
	connectPath: string;
}
