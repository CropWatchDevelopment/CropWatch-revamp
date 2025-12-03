// src/routes/auth/+page.server.ts
import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { verifyRecaptchaToken } from '$lib/utils/recaptcha.server';
import * as Sentry from '@sentry/sveltekit';

export const load: PageServerLoad = async ({ locals }) => {
	const { session } = await locals.safeGetSession();
	if (session) {
		throw redirect(303, '/');
	}
	return {};
};

export const actions: Actions = {
	signup: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const recaptchaToken = formData.get('recaptchaToken') as string;

		Sentry.addBreadcrumb({
			category: 'auth',
			message: 'Signup attempt',
			data: { email },
			level: 'info'
		});

		// Verify reCAPTCHA
		if (!recaptchaToken) {
			Sentry.captureMessage('Signup attempt without reCAPTCHA token', {
				level: 'warning',
				tags: { action: 'signup' }
			});
			return fail(400, { message: 'reCAPTCHA verification required.' });
		}

		const recaptchaResult = await verifyRecaptchaToken(recaptchaToken, 'SIGNUP');
		if (!recaptchaResult.success) {
			Sentry.captureMessage('reCAPTCHA verification failed during signup', {
				level: 'warning',
				tags: { action: 'signup' },
				extra: { email }
			});
			return fail(400, { message: 'reCAPTCHA verification failed. Please try again.' });
		}

		const { error } = await supabase.auth.signUp({ email, password });
		if (error) {
			Sentry.captureException(error, {
				tags: { action: 'signup' },
				extra: { email }
			});
			return fail(400, { message: error.message });
		}

		throw redirect(303, '/');
	},

	login: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const recaptchaToken = formData.get('recaptchaToken') as string;

		Sentry.addBreadcrumb({
			category: 'auth',
			message: 'Login attempt',
			data: { email },
			level: 'info'
		});

		// Verify reCAPTCHA
		if (!recaptchaToken) {
			Sentry.captureMessage('Login attempt without reCAPTCHA token', {
				level: 'warning',
				tags: { action: 'login' }
			});
			return fail(400, { message: 'reCAPTCHA verification required.' });
		}

		const recaptchaResult = await verifyRecaptchaToken(recaptchaToken, 'LOGIN');
		if (!recaptchaResult.success) {
			Sentry.captureMessage('reCAPTCHA verification failed during login', {
				level: 'warning',
				tags: { action: 'login' },
				extra: { email }
			});
			return fail(400, { message: 'reCAPTCHA verification failed. Please try again.' });
		}

		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			// Log failed login attempts (could indicate brute force or user trouble)
			Sentry.captureMessage('Failed login attempt', {
				level: 'warning',
				tags: { action: 'login', errorCode: error.code },
				extra: { email, errorMessage: error.message }
			});
			return fail(400, { message: 'Invalid login.' });
		}

		// Set user context on successful login
		Sentry.setUser({ email });

		throw redirect(303, '/');
	}
};
