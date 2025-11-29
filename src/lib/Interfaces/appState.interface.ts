import type { Device } from "./device.interface";
import type { Facility } from "./facility.interface";
import type { Location } from "./location.interface";

export interface AppState {
    facilities: Facility[];
    locations: Location[];
    devices: Device[];
    isLoggedIn: boolean;
}
