import type { LayoutServerLoad } from './$types';
import { loadInitialAppState } from '$lib/data/SourceOfTruth.svelte';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session } = await locals.safeGetSession();
	const tokens = session
		? { access_token: session.access_token, refresh_token: session.refresh_token }
		: undefined;

	const { nextCursor, ...appState } = await loadInitialAppState(tokens);

	if (!session) {
		appState.isLoggedIn = false;
	} else {
		appState.isLoggedIn = true;
	}

	return { ...appState, nextCursor };
};
