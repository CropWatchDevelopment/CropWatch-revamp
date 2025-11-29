import { PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../database.types';
import type { AppState } from '$lib/Interfaces/appState.interface';
import type { Device } from '$lib/Interfaces/device.interface';
import type { Facility } from '$lib/Interfaces/facility.interface';
import type { Location } from '$lib/Interfaces/location.interface';
import type { AppStateState } from '$lib/data/AppState.svelte';
import { goto } from '$app/navigation';
import { redirect } from '@sveltejs/kit';

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
const isTempKind = (kind: string | null | undefined) =>
	!!kind && kind.toLowerCase().includes('temp');
const isFahrenheit = (kind: string | null | undefined) =>
	!!kind && (kind.toLowerCase().includes('_f') || kind.toLowerCase().endsWith('f'));
const isKelvin = (kind: string | null | undefined) =>
	!!kind && (kind.toLowerCase().includes('_k') || kind.toLowerCase().endsWith('k'));
const isHumidityKind = (kind: string | null | undefined) =>
	!!kind && kind.toLowerCase().includes('humid');
const isCo2Kind = (kind: string | null | undefined) =>
	!!kind && kind.toLowerCase().includes('co2');

function normalizeTemperature(kind: string | null | undefined, value: number | null) {
	if (value == null) return null;
	if (isFahrenheit(kind)) return fToC(value);
	if (isKelvin(kind)) return kToC(value);
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

function computeStatus(
	lastSeen: string | null,
	deviceUploadInterval: number | null,
	defaultUploadInterval: number | null
) {
	const minutes =
		deviceUploadInterval ??
		defaultUploadInterval ??
		30; // fallback to 30 minutes if nothing is configured

	const allowanceMs = minutes * 60 * 1000;
	const lastSeenDate = lastSeen ? new Date(lastSeen) : null;
	if (!lastSeenDate || Number.isNaN(lastSeenDate.getTime())) return 'offline';

	const ageMs = Date.now() - lastSeenDate.getTime();
	return ageMs > allowanceMs ? 'offline' : 'online';
}

function mapDevice(row: DeviceJoined): Device {
	const deviceType = row.device_type;
	const primaryKind = deviceType?.primary_data_v2 ?? deviceType?.primary_data ?? 'temperature_c';
	const secondaryKind = deviceType?.secondary_data_v2 ?? deviceType?.secondary_data ?? 'humidity';

	const temperatureC = isTempKind(primaryKind)
		? normalizeTemperature(primaryKind, row.primary_data ?? null)
		: isTempKind(secondaryKind)
			? normalizeTemperature(secondaryKind, row.secondary_data ?? null)
			: null;

	const humidity = isHumidityKind(secondaryKind)
		? row.secondary_data ?? null
		: isHumidityKind(primaryKind)
			? row.primary_data ?? null
			: null;

	const co2 =
		isCo2Kind(primaryKind) && row.primary_data != null
			? Number(row.primary_data)
			: isCo2Kind(secondaryKind) && row.secondary_data != null
				? Number(row.secondary_data)
				: null;

	const loc = row.location;
	const lastSeen = row.last_data_updated_at ?? row.installed_at ?? '';
	const status = computeStatus(lastSeen, row.upload_interval, deviceType?.default_upload_interval);

	return {
		id: row.dev_eui,
		name: row.name,
		locationId: loc ? String(loc.location_id) : 'unknown',
		facilityId: loc?.owner_id ? String(loc.owner_id) : `facility-${loc?.location_id ?? 'unknown'}`,
		temperatureC: temperatureC ?? 0,
		humidity: humidity ?? 0,
		co2: co2 ?? null,
		lastSeen,
		status,
		hasAlert: false,
		data: []
	};
}

type CachedType = {
	typeId: number;
	row: DeviceTypeRow;
};

type CachedLocation = {
	locationId: number;
	row: LocationRow;
};

async function fetchDeviceType(
	client: ReturnType<typeof createSupabaseClient>,
	typeId: number,
	cache: Map<number, DeviceTypeRow>
) {
	if (cache.has(typeId)) return cache.get(typeId) as DeviceTypeRow;
	const { data, error } = await client
		.from('cw_device_type')
		.select('*')
		.eq('id', typeId)
		.maybeSingle();
	if (error) throw error;
	if (data) cache.set(typeId, data);
	return data ?? null;
}

async function fetchLocation(
	client: ReturnType<typeof createSupabaseClient>,
	locationId: number,
	cache: Map<number, LocationRow>
) {
	if (cache.has(locationId)) return cache.get(locationId) as LocationRow;
	const { data, error } = await client
		.from('cw_locations')
		.select('*')
		.eq('location_id', locationId)
		.maybeSingle();
	if (error) throw error;
	if (data) cache.set(locationId, data);
	return data ?? null;
}

/**
 * Subscribe to realtime inserts/updates on cw_devices and merge into appState.devices.
 * Returns an unsubscribe function.
 */
export async function startDeviceRealtime(appState: AppStateState) {
	const supabase = await createSupabaseClient();
	const typeCache = new Map<number, DeviceTypeRow>();
	const locationCache = new Map<number, LocationRow>();

	const channel = supabase
		.channel('cw-devices-updates')
		.on(
			'postgres_changes',
			{ event: 'UPDATE', schema: 'public', table: 'cw_devices' },
			async (payload) => {
				await handlePayload(payload, supabase, appState, typeCache, locationCache);
			}
		)
		.on(
			'postgres_changes',
			{ event: 'INSERT', schema: 'public', table: 'cw_devices' },
			async (payload) => {
				await handlePayload(payload, supabase, appState, typeCache, locationCache);
			}
		)
		.subscribe();

	return () => {
		supabase.removeChannel(channel);
	};
}

async function handlePayload(
	payload: { new: Record<string, unknown> },
	client: ReturnType<typeof createSupabaseClient>,
	appState: AppStateState,
	typeCache: Map<number, DeviceTypeRow>,
	locationCache: Map<number, LocationRow>
) {
	const row = payload.new as DeviceRow;
	if (!row?.dev_eui) return;

	let device_type: DeviceTypeRow | null = null;
	if (row.type != null) {
		device_type = await fetchDeviceType(client, row.type, typeCache);
	}

	let location: LocationRow | null = null;
	if (row.location_id != null) {
		location = await fetchLocation(client, row.location_id, locationCache);
	}

	const mapped = mapDevice({
		...row,
		device_type: device_type ?? undefined,
		location: location ?? undefined
	});

	const idx = appState.devices.findIndex((d) => d.id === mapped.id);
	if (idx >= 0) {
		appState.devices = [
			...appState.devices.slice(0, idx),
			mapped,
			...appState.devices.slice(idx + 1)
		];
	} else {
		appState.devices = [mapped, ...appState.devices];
	}
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
				'upload_interval',
				'location_id',
				'last_data_updated_at',
				'installed_at',
				'type',
				'location:cw_locations(location_id,name,lat,long,owner_id)',
				'device_type:cw_device_type(primary_data_v2,secondary_data_v2,primary_data_notation,secondary_data_notation,default_upload_interval)'
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

export async function loadInitialAppState(
	session?: AuthSession
): Promise<AppState & { nextCursor: string | null }> {
	const { devices, locations, facilities, nextCursor } = await fetchDevicePage({
		limit: 100,
		session
	});
	return { devices, locations, facilities, nextCursor, isLoggedIn: !!session };
}

export type DeviceHistoryPoint = {
	timestamp: string;
	primary: number | null;
	secondary: number | null;
	co2?: number | null;
	battery?: number | null;
	raw: Record<string, unknown>;
};

/**
 * Fetch historic data for a device based on its device_type.data_table_v2 definition.
 * This is intentionally client-friendly (uses publishable key) and limits rows to avoid heavy pulls.
 */
export async function fetchDeviceHistory({
	devEui,
	limit = 500,
	hoursBack = 24,
	session
}: {
	devEui: string;
	limit?: number;
	hoursBack?: number;
	session?: AuthSession;
}) {
	const supabase = await createSupabaseClient(session);

	const { data: deviceRow, error: deviceError } = await supabase
		.from('cw_devices')
		.select(
			'dev_eui,type,device_type:cw_device_type(data_table_v2,primary_data_v2,secondary_data_v2)'
		)
		.eq('dev_eui', devEui)
		.maybeSingle();

	if (deviceError) throw deviceError;
	if (!deviceRow?.device_type?.data_table_v2) {
		return { points: [] as DeviceHistoryPoint[], meta: null as unknown as Record<string, unknown> };
	}

	const table = deviceRow.device_type.data_table_v2;
	const primaryKey = deviceRow.device_type.primary_data_v2;
	const secondaryKey = deviceRow.device_type.secondary_data_v2;
	const co2Key =
		(primaryKey && primaryKey.toLowerCase().includes('co2') && primaryKey) ||
		(secondaryKey && secondaryKey.toLowerCase().includes('co2') && secondaryKey) ||
		'co2';
	const sinceIso = hoursBack ? new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString() : null;

	let query = supabase
		.from(table)
		.select('*')
		.eq('dev_eui', devEui)
		.order('created_at', { ascending: false, nulls: 'last' });

	if (sinceIso) {
		query = query.gte('created_at', sinceIso);
	}

	if (limit) {
		query = query.limit(limit);
	}

	const { data: rows, error: historyError } = await query;

	if (historyError) throw historyError;

	const points: DeviceHistoryPoint[] =
		rows?.map((row: Record<string, unknown>) => {
			const primary = primaryKey ? Number(row[primaryKey] ?? null) : null;
			const secondary = secondaryKey ? Number(row[secondaryKey] ?? null) : null;
			const battery = 'battery_level' in row ? Number(row['battery_level']) : null;
			const co2Value = co2Key ? Number(row[co2Key] ?? null) : null;
			const fallbackCo2 =
				co2Value && Number.isFinite(co2Value)
					? co2Value
					: (() => {
							const foundKey = Object.keys(row).find((k) => k.toLowerCase().includes('co2'));
							if (!foundKey) return null;
							const val = Number(row[foundKey]);
							return Number.isFinite(val) ? val : null;
						})();

			return {
				timestamp:
					(typeof row.created_at === 'string' && row.created_at) ||
					(typeof row.timestamp === 'string' && row.timestamp) ||
					'',
				primary: Number.isFinite(primary) ? (primary as number) : null,
				secondary: Number.isFinite(secondary) ? (secondary as number) : null,
				co2: Number.isFinite(co2Value ?? fallbackCo2) ? (co2Value ?? fallbackCo2) : null,
				battery: Number.isFinite(battery) ? (battery as number) : null,
				raw: row
			};
		}) ?? [];

	return {
		points,
		meta: {
			table,
			primaryKey,
			secondaryKey
		}
	};
}
