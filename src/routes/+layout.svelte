<script lang="ts">
	import Header from '$lib/core/Header.svelte';
	import Sidebar from '$lib/core/Sidebar.svelte';
	import type { Device } from '$lib/Interfaces/device.interface';
	import type { Facility } from '$lib/Interfaces/facility.interface';
	import type { Location } from '$lib/Interfaces/location.interface';
	import './layout.css';

	let { data, children } = $props<{
		data: { facilities: Facility[]; locations: Location[]; devices: Device[] };
	}>();

	const facilities = data?.facilities ?? [];
	const locations = data?.locations ?? [];
	const devices = data?.devices ?? [];

	let selectedFacilityId = $state<string | 'all'>('all');
	let selectedLocationId = $state<string | 'all'>('all');

	const locationsForFacility = $derived(
		selectedFacilityId === 'all'
			? locations
			: locations.filter((l) => l.facilityId === selectedFacilityId)
	);

	const total = $derived(devices.length);
	const alerts = $derived(devices.filter((d) => d.hasAlert).length);
	const offline = $derived(devices.filter((d) => d.status === 'offline').length);
</script>

<div class="app flex min-h-screen flex-col bg-slate-950 text-slate-100">
	<Header />
	<div class="flex flex-1 overflow-hidden">
		<Sidebar
			{facilities}
			{locationsForFacility}
			{devices}
			bind:selectedFacilityId
			bind:selectedLocationId
			{total}
			{alerts}
			{offline}
		/>
		<main class="flex-1 overflow-auto">
			{@render children()}
		</main>
	</div>
</div>
