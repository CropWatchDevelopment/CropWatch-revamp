import type { LayoutServerLoad } from './$types';
import { loadInitialAppState } from '$lib/data/SourceOfTruth.svelte';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const { session } = await locals.safeGetSession();
	
	// If no valid session, the hooks.server.ts should have already redirected.
	// But as a safety net, redirect here too if somehow we got here without a session.
	if (!session) {
		// Return minimal data for auth pages (hooks allows /auth routes through)
		return {
			session: null,
			cookies: cookies.getAll(),
			facilities: [],
			locations: [],
			devices: [],
			alerts: [],
			isLoggedIn: false,
			nextCursor: null
		};
	}

	const tokens = {
		access_token: session.access_token,
		refresh_token: session.refresh_token
	};

	try {
		const { nextCursor, ...appState } = await loadInitialAppState(tokens);
		appState.isLoggedIn = true;
		return { ...appState, session, cookies: cookies.getAll(), nextCursor };
	} catch (error) {
		console.error('Failed to load initial app state', error);
		
		// If we have a session but data loading fails, it might be a token issue
		// Redirect to auth to re-authenticate
		throw redirect(303, '/auth');
	}
};
