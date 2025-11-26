import type { Facility } from '$lib/Interfaces/facility.interface';
import type { DeviceStatus } from '$lib/types/DeviceStatus.type';

interface Location {
	id: string;
	name: string;
	facilityId: string;
}

interface Device {
	id: string;
	name: string;
	locationId: string;
	facilityId: string;
	temperatureC: number;
	humidity: number;
	lastSeen: string;
	status: DeviceStatus;
	hasAlert: boolean;
}

export const load = () => {
	const facilities: Facility[] = [
		{ id: 'f1', name: 'Miyazaki Processing Plant', code: 'MZK' },
		{ id: 'f2', name: 'Kumamoto Cold Storage', code: 'KMT' },
		{ id: 'f3', name: 'Tokyo DC', code: 'TYO' }
	];

	const locations: Location[] = [
		{ id: 'l1', name: 'Freezer Aisle 01', facilityId: 'f1' },
		{ id: 'l2', name: 'Chilled Room 02', facilityId: 'f1' },
		{ id: 'l3', name: 'Dock Side', facilityId: 'f2' },
		{ id: 'l4', name: 'Packing Line', facilityId: 'f3' }
	];

	const devices: Device[] = [
		{
			id: 'd1',
			name: 'TH-01',
			locationId: 'l1',
			facilityId: 'f1',
			temperatureC: -18.2,
			humidity: 42,
			lastSeen: '2025-11-26T10:01:00Z',
			status: 'online',
			hasAlert: false
		},
		{
			id: 'd2',
			name: 'TH-02',
			locationId: 'l1',
			facilityId: 'f1',
			temperatureC: -15.9,
			humidity: 60,
			lastSeen: '2025-11-26T09:55:00Z',
			status: 'alert',
			hasAlert: true
		},
		{
			id: 'd3',
			name: 'TH-03',
			locationId: 'l2',
			facilityId: 'f1',
			temperatureC: 4.1,
			humidity: 78,
			lastSeen: '2025-11-26T09:40:00Z',
			status: 'offline',
			hasAlert: true
		},
		{
			id: 'd4',
			name: 'TH-11',
			locationId: 'l3',
			facilityId: 'f2',
			temperatureC: 8.4,
			humidity: 55,
			lastSeen: '2025-11-26T10:02:00Z',
			status: 'loading',
			hasAlert: false
		}
	];

	return {
		facilities,
		locations,
		devices
	};
};
