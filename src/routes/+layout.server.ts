import type { LayoutServerLoad } from './$types';
import { loadInitialAppState } from '$lib/data/SourceOfTruth.svelte';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session } = await locals.safeGetSession();
	const tokens = session
		? { access_token: session.access_token, refresh_token: session.refresh_token }
		: undefined;

	try {
		const { nextCursor, ...appState } = await loadInitialAppState(tokens);
		appState.isLoggedIn = !!session;
		return { ...appState, nextCursor };
	} catch (error) {
		console.error('Failed to load initial app state', error);
		return {
			facilities: [],
			locations: [],
			devices: [],
			alerts: [],
			isLoggedIn: !!session,
			nextCursor: null
		};
	}
};
