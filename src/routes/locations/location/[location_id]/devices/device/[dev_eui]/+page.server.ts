import type { PageServerLoad } from './$types';
import { fetchDeviceHistory } from '$lib/data/SourceOfTruth.svelte';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { session } = await locals.safeGetSession?.();
	const tokens = session
		? { access_token: session.access_token, refresh_token: session.refresh_token }
		: undefined;

	const { points } = await fetchDeviceHistory({
		devEui: params.dev_eui,
		limit: 2000,
		hoursBack: 24,
		session: tokens
	});

	return {
		initialHistory: points.map((p) => ({
			timestamp: p.timestamp,
			primary: p.primary,
			secondary: p.secondary
		}))
	};
};
