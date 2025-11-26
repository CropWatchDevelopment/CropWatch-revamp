import type { Facility } from '$lib/Interfaces/facility.interface';
import type { DeviceDataHistory } from '$lib/Interfaces/deviceDataHistory.interface';
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
	data: DeviceDataHistory[];
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
			hasAlert: false,
			data: [
				{
					timestamp: '2025-11-26T10:00:00Z',
					temperature: -18.3,
					humidity: 43,
					alert: false
				},
				{
					timestamp: '2025-11-26T09:00:00Z',
					temperature: -17.8,
					humidity: 45,
					alert: false
				},
				{
					timestamp: '2025-11-26T08:00:00Z',
					temperature: -16.5,
					humidity: 51,
					alert: true,
					note: 'Door held open'
				}
			]
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
			hasAlert: true,
			data: [
				{
					timestamp: '2025-11-26T10:00:00Z',
					temperature: -16.1,
					humidity: 61,
					alert: true,
					note: 'Exceeds temp threshold'
				},
				{
					timestamp: '2025-11-26T09:00:00Z',
					temperature: -15.4,
					humidity: 58,
					alert: false
				},
				{
					timestamp: '2025-11-26T08:00:00Z',
					temperature: -14.9,
					humidity: 56,
					alert: false
				}
			]
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
			hasAlert: true,
			data: [
				{
					timestamp: '2025-11-26T09:30:00Z',
					temperature: 4.5,
					humidity: 80,
					alert: true,
					note: 'Sensor offline'
				},
				{
					timestamp: '2025-11-26T08:30:00Z',
					temperature: 4.2,
					humidity: 77,
					alert: true
				},
				{
					timestamp: '2025-11-26T07:30:00Z',
					temperature: 3.9,
					humidity: 74,
					alert: false
				}
			]
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
			hasAlert: false,
			data: [
				{
					timestamp: '2025-11-26T10:00:00Z',
					temperature: 8.2,
					humidity: 54,
					alert: false
				},
				{
					timestamp: '2025-11-26T09:00:00Z',
					temperature: 8.5,
					humidity: 55,
					alert: false
				},
				{
					timestamp: '2025-11-26T08:00:00Z',
					temperature: 8.1,
					humidity: 53,
					alert: false
				}
			]
		}
	];

	return {
		facilities,
		locations,
		devices
	};
};
