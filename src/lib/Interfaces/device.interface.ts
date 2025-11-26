import type { DeviceStatus } from "$lib/types/DeviceStatus.type";
import type { DeviceDataHistory } from "./deviceDataHistory.interface";

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
    data: DeviceDataHistory[];
}