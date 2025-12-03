import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import * as Sentry from '@sentry/sveltekit';

export const load: PageServerLoad = async ({ locals, params }) => {
    const { session } = await locals.safeGetSession();

    if (!session) {
        throw redirect(303, '/auth');
    }

    const { supabase } = locals;

    // fetch this specific location data based on the location_id in the url
    const { data: locations, error: locationsError } = await supabase
        .from('cw_locations')
        .select(`
            location_id,
            name,
            description,
            lat,
            long,
            created_at,
            owner_id,
            owner:profiles!cw_locations_owner_id_fkey (
                id,
                full_name,
                email
            )
        `)
        .eq('owner_id', session.user.id)
        .eq('location_id', parseInt(params.location_id))
        .single();

    if (locationsError) {
        console.error('Error fetching locations:', locationsError);
        Sentry.captureException(locationsError, {
            tags: { operation: 'fetchLocationById' },
            extra: { locationId: params.location_id, userId: session.user.id }
        });
    }

    return {
        session,
        location: locations || null
    };

};