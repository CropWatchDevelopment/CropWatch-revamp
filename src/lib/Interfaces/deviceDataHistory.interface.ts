	export interface DeviceDataHistory {
		timestamp: string;
		temperature: number;
		humidity: number;
		alert: boolean;
		note?: string;
	};