// src/routes/auth/callback/+server.ts
import { redirect } from '@sveltejs/kit';

export const GET = async ({ locals, url }) => {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) {
    console.error('OAuth callback error:', error);
    throw redirect(303, `/auth?error=${error}`);
  }
  if (code) {
    // Exchange the auth code for a session (access & refresh tokens)
    const { error: exchangeError } = await locals.supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error('Code exchange failed:', exchangeError);
      throw redirect(303, '/auth/error');
    }
    // Supabase has set the session cookie at this point:contentReference[oaicite:17]{index=17}.
  }
  // Redirect to a post-login page (e.g., the protected area)
  throw redirect(303, '/private');
};
