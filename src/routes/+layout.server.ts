import type { LayoutServerLoad } from './$types';
import { loadInitialAppState } from '$lib/data/SourceOfTruth.svelte';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const access_token = cookies.get('sb-access-token');
	const refresh_token = cookies.get('sb-refresh-token');
	const session =
		access_token && refresh_token ? { access_token, refresh_token } : undefined;

	const { nextCursor, ...appState } = await loadInitialAppState(session);
	return { ...appState, nextCursor };
};
