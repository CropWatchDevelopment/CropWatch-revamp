// src/routes/auth/callback/+server.ts
import { redirect } from '@sveltejs/kit';
import * as Sentry from '@sentry/sveltekit';

export const GET = async ({ locals, url }) => {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const next = url.searchParams.get('next') ?? '/';
  
  if (error) {
    console.error('OAuth callback error:', error);
    Sentry.captureMessage('OAuth callback error', {
      level: 'warning',
      tags: { action: 'oauthCallback' },
      extra: { error }
    });
    throw redirect(303, `/auth?error=${error}`);
  }
  if (code) {
    // Exchange the auth code for a session (access & refresh tokens)
    const { error: exchangeError } = await locals.supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error('Code exchange failed:', exchangeError);
      Sentry.captureException(exchangeError, {
        tags: { action: 'codeExchange' }
      });
      throw redirect(303, '/auth/error');
    }
    // Supabase has set the session cookie at this point
  }
  // Redirect to the specified next page or home
  throw redirect(303, next);
};
