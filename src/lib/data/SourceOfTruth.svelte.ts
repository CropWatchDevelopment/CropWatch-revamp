import { PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../database.types';
import type { AppState } from '$lib/Interfaces/appState.interface';
import type { Device } from '$lib/Interfaces/device.interface';
import type { Facility } from '$lib/Interfaces/facility.interface';
import type { Location } from '$lib/Interfaces/location.interface';

type DeviceRow = Database['public']['Tables']['cw_devices']['Row'];
type LocationRow = Database['public']['Tables']['cw_locations']['Row'];
type DeviceTypeRow = Database['public']['Tables']['cw_device_type']['Row'];

type DeviceJoined = DeviceRow & {
	location?: LocationRow | null;
	device_type?: DeviceTypeRow | null;
};

type AuthSession = { access_token: string; refresh_token: string };

async function createSupabaseClient(session?: AuthSession) {
	if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) {
		throw new Error('Supabase environment variables are not set.');
	}

	const client = createClient<Database>(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
		{
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		}
	);

	if (session?.access_token && session?.refresh_token) {
		await client.auth.setSession({
			access_token: session.access_token,
			refresh_token: session.refresh_token
		});
	}

	return client;
}

const fToC = (value: number | null) => (value == null ? null : (value - 32) / 1.8);
const kToC = (value: number | null) => (value == null ? null : value - 273.15);

function normalizeTemperature(kind: string | null | undefined, value: number | null) {
	if (value == null) return null;
	if (kind === 'temperature_f') return fToC(value);
	if (kind === 'temperature_k') return kToC(value);
	return value;
}

function mapFacility(loc: LocationRow): Facility {
	const id = loc.owner_id ? String(loc.owner_id) : `facility-${loc.location_id}`;
	return {
		id,
		name: `Facility ${id}`,
		code: `F-${id.slice(0, 4)}`
	};
}

function mapLocation(loc: LocationRow): Location {
	return {
		id: String(loc.location_id),
		name: loc.name ?? 'Unknown location',
		facilityId: loc.owner_id ? String(loc.owner_id) : `facility-${loc.location_id}`
	};
}

function mapDevice(row: DeviceJoined): Device {
	const deviceType = row.device_type;
	const primaryKind = deviceType?.primary_data ?? 'temperature_c';
	const secondaryKind = deviceType?.secondary_data ?? 'humidity';

	const temperatureC =
		primaryKind === 'temperature_c' ||
		primaryKind === 'temperature_f' ||
		primaryKind === 'temperature_k'
			? normalizeTemperature(primaryKind, row.primary_data ?? null)
			: null;

	const humidity = secondaryKind === 'humidity' ? row.secondary_data ?? null : null;

	const loc = row.location;

	return {
		id: row.dev_eui,
		name: row.name,
		locationId: loc ? String(loc.location_id) : 'unknown',
		facilityId: loc?.owner_id ? String(loc.owner_id) : `facility-${loc?.location_id ?? 'unknown'}`,
		temperatureC: temperatureC ?? 0,
		humidity: humidity ?? 0,
		lastSeen: row.last_data_updated_at ?? row.installed_at ?? '',
		status: 'online',
		hasAlert: false,
		data: []
	};
}

export async function fetchDevicePage({
	limit = 50,
	cursor,
	locationId,
	session
}: {
	limit?: number;
	cursor?: string;
	locationId?: number;
	session?: AuthSession;
}) {
	const supabase = await createSupabaseClient(session);

	let query = supabase
		.from('cw_devices')
		.select(
			[
				'dev_eui',
				'name',
				'primary_data',
				'secondary_data',
				'location_id',
				'last_data_updated_at',
				'installed_at',
				'type',
				'location:cw_locations(location_id,name,lat,long,owner_id)',
				'device_type:cw_device_type(primary_data,secondary_data,primary_data_notation,secondary_data_notation)'
			].join(',')
		)
		.order('dev_eui', { ascending: true })
		.limit(limit + 1);

	if (cursor) {
		query = query.gt('dev_eui', cursor);
	}

	if (locationId !== undefined) {
		query = query.eq('location_id', locationId);
	}

	const { data, error } = await query;
	if (error) {
		throw error;
	}

	const pageItems = data.slice(0, limit);
	const nextCursor = data.length > limit ? data[limit].dev_eui : null;

	const devices = pageItems.map((row) => mapDevice(row as DeviceJoined));

	const locationsMap = new Map<string, Location>();
	const facilitiesMap = new Map<string, Facility>();

	for (const row of pageItems) {
		const loc = (row as DeviceJoined).location;
		if (loc) {
			const mappedLocation = mapLocation(loc);
			locationsMap.set(mappedLocation.id, mappedLocation);
			facilitiesMap.set(mappedLocation.facilityId, mapFacility(loc));
		}
	}

	return {
		devices,
		locations: Array.from(locationsMap.values()),
		facilities: Array.from(facilitiesMap.values()),
		nextCursor
	};
}

export async function loadInitialAppState(session?: AuthSession): Promise<AppState & { nextCursor: string | null }> {
	const { devices, locations, facilities, nextCursor } = await fetchDevicePage({ limit: 100, session });
	return { devices, locations, facilities, nextCursor };
}
