import { PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Database } from '../../../../database.types';

function getSupabaseClient() {
	if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) {
		throw new Error('Supabase environment variables are not set.');
	}

	return createClient<Database>(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
		{
			auth: {
				persistSession: false,
				autoRefreshToken: false
			}
		}
	);
}

export const load: PageServerLoad = async ({ cookies }) => {
	const hasSession =
		!!cookies.get('sb-access-token') && !!cookies.get('sb-refresh-token');
	if (hasSession) {
		throw redirect(303, '/');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { message: 'Email and password are required.' });
		}

		const supabase = getSupabaseClient();
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (error || !data.session) {
			return fail(400, {
				message: error?.message ?? 'Login failed. Please check your credentials.'
			});
		}

		const { access_token, refresh_token, expires_in, expires_at } = data.session;

		const accessExpiry =
			expires_at != null
				? new Date(expires_at * 1000)
				: new Date(Date.now() + expires_in * 1000);

		const accessCookieOptions = {
			path: '/',
			httpOnly: true,
			sameSite: 'lax' as const,
			secure: true,
			expires: accessExpiry
		};

		// Refresh token typically lives longer; give it ~60 days.
		const refreshCookieOptions = {
			...accessCookieOptions,
			expires: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
		};

		cookies.set('sb-access-token', access_token, accessCookieOptions);
		cookies.set('sb-refresh-token', refresh_token, refreshCookieOptions);

		throw redirect(303, '/');
	}
};
