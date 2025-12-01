<script lang="ts">
	import Header from '$lib/core/Header.svelte';
	import Sidebar from '$lib/core/Sidebar.svelte';
	import type { Device } from '$lib/Interfaces/device.interface';
	import type { Facility } from '$lib/Interfaces/facility.interface';
	import type { Location } from '$lib/Interfaces/location.interface';
	import './layout.css';
	import type { AppState } from '$lib/Interfaces/appState.interface';
	import { createAppState, provideAppState, useAppState } from '$lib/data/AppState.svelte';
	import { setContext } from 'svelte';
	import type { LayoutProps } from './$types';
	import { CWToastContainer, createToastContext } from '$lib/components/toast';

	let { data, supabase, children } = $props<LayoutProps>();

	// Create toast context so all child components can use it
	createToastContext();

	let appState = createAppState({
		facilities: data.facilities,
		locations: data.locations,
		devices: data.devices,
		alerts: data.alerts,
		isLoggedIn: data.isLoggedIn ?? false
	});

	$effect(() => {
		appState.facilities = data.facilities;
		appState.locations = data.locations;
		appState.devices = data.devices;
		appState.alerts = data.alerts;
		appState.isLoggedIn = data.isLoggedIn ?? false;
	});

	provideAppState(appState);

	let selectedFacilityId = $state<string | 'all'>('all');
	let selectedLocationId = $state<string | 'all'>('all');

	// Share selection with child pages
	setContext('filters', {
		getFacility: () => selectedFacilityId,
		getLocation: () => selectedLocationId
	});

	const locationsForFacility = $derived(
		selectedFacilityId === 'all'
			? appState.locations
			: appState.locations.filter((l: Location) => l.facilityId === selectedFacilityId)
	);

	const total = $derived(appState.devices.length);
	const alerts = $derived(appState.alerts.length);
	const offline = $derived(appState.devices.filter((d: Device) => d.status === 'offline').length);
</script>

<div class="app flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
	<CWToastContainer position="top-right" />
	<div class="flex min-h-0 flex-1 flex-row overflow-hidden">
		{#if appState.isLoggedIn}
			<Sidebar
				facilities={appState.facilities}
				devices={appState.devices}
				{locationsForFacility}
				bind:selectedFacilityId
				bind:selectedLocationId
				{total}
				{alerts}
				{offline}
			/>
		{/if}
		<main class="flex min-h-0 flex-1 flex-col overflow-auto">
			{#if appState.isLoggedIn}
				<Header isLoggedIn={appState.isLoggedIn} />
			{/if}
			{@render children()}
		</main>
	</div>
</div>
