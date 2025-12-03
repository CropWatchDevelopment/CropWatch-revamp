import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
// src/hooks.server.ts
import { createServerClient } from '@supabase/ssr';
import { type Handle, type HandleServerError, redirect } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY } from '$env/static/public';

// Initialize Sentry for server-side error tracking
Sentry.init({
	dsn: 'https://ba36cb18f97a466e35b23ed5ab9c916e@o4509301976530944.ingest.us.sentry.io/4509513210789888',
	tracesSampleRate: 1.0,
	environment: process.env.NODE_ENV || 'development',
	// Enable sending user context
	sendDefaultPii: true,
	// Set release version for tracking
	release: process.env.npm_package_version || '0.0.1'
});

export const handle: Handle = sequence(Sentry.sentryHandle(), async ({ event, resolve }) => {
	// Create a Supabase client for this request, with cookie auth enabled
	event.locals.supabase = createServerClient(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
		{
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookiesToSet) => {
					cookiesToSet.forEach(({ name, value, options }) => {
						event.cookies.set(name, value, { ...options, path: '/' });
					});
				}
			}
		}
	);

	event.locals.safeGetSession = async () => {
		// IMPORTANT: Always use getUser() for server-side validation as it contacts
		// the Supabase Auth server. getSession() only reads from cookies/storage
		// and can return stale/expired tokens.
		const {
			data: { user },
			error: userError
		} = await event.locals.supabase.auth.getUser();

		// If getUser() fails (expired token, invalid token, etc.), clear the session
		if (userError || !user) {
			return { session: null, user: null };
		}

		// Only after validating the user, get the session for the tokens
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();

		// Double-check: if we have a user but no session, something is wrong
		if (!session) {
			return { session: null, user: null };
		}

		return { session, user };
	};

	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	const isAuthRoute = event.url.pathname.startsWith('/auth');
	const isPublicApiRoute = event.url.pathname.startsWith('/api/public');

	// Redirect to auth if no valid session and not on auth/public routes
	if (!session && !isAuthRoute && !isPublicApiRoute) {
		throw redirect(303, '/auth');
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
});

// Custom error handler with Sentry integration
export const handleError: HandleServerError = Sentry.handleErrorWithSentry(async ({ error, event, status, message }) => {
	const errorId = crypto.randomUUID();
	
	// Add user context to Sentry if available
	if (event.locals.user) {
		Sentry.setUser({
			id: event.locals.user.id,
			email: event.locals.user.email
		});
	}

	// Capture additional context
	Sentry.setContext('request', {
		url: event.url.href,
		method: event.request.method,
		route: event.route?.id
	});

	// Log error details for debugging
	console.error(`[${errorId}] Server Error:`, {
		status,
		message,
		url: event.url.href,
		route: event.route?.id,
		error: error instanceof Error ? error.message : String(error)
	});

	return {
		message: status === 500 ? 'An unexpected error occurred. Our team has been notified.' : message,
		errorId
	};
});