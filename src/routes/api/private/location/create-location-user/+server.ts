import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * CREATE a location user.
 */
export const POST: RequestHandler = async ({ request, params, locals }) => {
	// Verify authentication
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const supabase = locals.supabase;

    const body = await request.json();
    const location_id: number = +body.location_id;
    const userToAdd: string = body.user_id;
    const permissionLevel: number = +body.permission_level;

    // Validate input
    if (!location_id || typeof location_id !== 'number') {
        return json({ success: false, error: 'Location ID is required' }, { status: 400 });
    }

    if (!userToAdd || typeof userToAdd !== 'string') {
        return json({ success: false, error: 'User ID to add is required' }, { status: 400 });
    }
    
    if (!permissionLevel || typeof permissionLevel !== 'number') {
        return json({ success: false, error: 'Permission level is required' }, { status: 400 });
    }

    try {
        // Check if the location exists and the current user has permission to add users
        const { data: location, error: locationError } = await supabase
            .from('cw_locations')
            .select('location_id, owner_id')
            .eq('location_id', location_id)
            .eq('owner_id', user.id) // Ensure user is the owner
            .maybeSingle();

        const isLocationOwner = location !== null;

        if (!isLocationOwner) {
            // If not the owner, then check permissions table
            // check if the user has permission level 2 or lower for the location
            const { data: locationUser, error: locationUserError } = await supabase
                .from('cw_locations_owners')
                .select('permission_level')
                .eq('location_id', location_id)
                .eq('user_id', user.id)
                .maybeSingle();
    
            const hasSufficientPermission = locationUser && locationUser.permission_level <= 2;
    
            if (locationError) {
                console.error('Database error fetching location:', locationError);
                return json({ 
                    success: false, 
                    error: 'Failed to fetch location.' 
                }, { status: 500 });
            }
        }

        // Add the user to the location with the specified permission level
        const { error: insertError } = await supabase
            .from('cw_location_owners')
            .insert({
                location_id: location_id,
                user_id: userToAdd,
                permission_level: permissionLevel
            });

        if (insertError) {
            console.error('Database error adding location user:', insertError);
            return json({ 
                success: false, 
                error: 'Failed to add user to location.' 
            }, { status: 500 });
        }

        return json({ 
            success: true, 
            message: 'User added to location successfully.' 
        }, { status: 200 });

    } catch (error) {
        console.error('Error adding location user:', error);
        return json({ success: false, error: 'Internal server error' }, { status: 500 });
    }

};
