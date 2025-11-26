import type { DeviceStatus } from "$lib/types/DeviceStatus.type";

export interface Device {
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