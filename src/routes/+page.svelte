<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import CWTable from '$lib/components/CWTable.svelte';
	import type { DeviceStatus } from '$lib/types/DeviceStatus.type';
	import type { Facility } from '$lib/Interfaces/facility.interface';
	import type { Location } from '$lib/Interfaces/location.interface';
	import type { Device } from '$lib/Interfaces/device.interface';

	import { useAppState } from '$lib/data/AppState.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { startDeviceRealtime } from '$lib/data/SourceOfTruth.svelte';

	import NOTIFICATIONS_ICON from '$lib/images/icons/notifications.svg';
	import CWButton from '$lib/components/CWButton.svelte';
	import CWPill from '$lib/components/CWPill.svelte';
	import CWResizablePanel from '$lib/components/CWResizablePanel.svelte';
	import { persisted } from '$lib/data/localStorage.svelte';
	import CWDonutChart, { type DonutSegment } from '$lib/components/CWDonutChart.svelte';
	import type { Alert } from '$lib/Interfaces/alert.interface';
	import ACTIVE_ALERT_ICON from '$lib/images/icons/active_alert.svg';
	import REFRESH_ICON from '$lib/images/icons/refresh.svg';

	const getAppState = useAppState();
	let appState = $derived(getAppState());

	// Receive sidebar selections from layout context
	const filters = getContext<{
		getFacility: () => string | 'all';
		getLocation: () => string | 'all';
	}>('filters');
	let selectedFacilityId = $derived(filters.getFacility());
	let selectedLocationId = $derived(filters.getLocation());
	let tableLoading: boolean = $state<boolean>(false);
	let showAlertPanel = persisted('showAlertPanel', { open: true });

	// Status helpers
	const statusConfig: Record<
		DeviceStatus,
		{ label: string; dotClass: string; badgeClass: string }
	> = {
		online: {
			label: 'Online',
			dotClass: 'bg-emerald-500',
			badgeClass: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
		},
		offline: {
			label: 'Offline',
			dotClass: 'bg-rose-500',
			badgeClass: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
		},
		loading: {
			label: 'Loading',
			dotClass: 'bg-slate-400',
			badgeClass: 'bg-slate-50 text-slate-700 ring-1 ring-slate-100'
		},
		alert: {
			label: 'Alert',
			dotClass: 'bg-amber-500',
			badgeClass: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
		}
	};

	const getFacility = (id: string) => appState.facilities.find((f: Facility) => f.id === id);
	const getLocation = (id: string) => appState.locations.find((l: Location) => l.id === id);
	const STATUS_TYPES: DeviceStatus[] = ['online', 'offline', 'loading', 'alert'];

	const deviceMatchesSearch = (d: Device, q: string) => {
		if (!q?.trim()) return true;
		const facility = getFacility(d.facilityId);
		const location = getLocation(d.locationId);
		const haystack = [d.id, d.name, facility?.name, facility?.code, location?.name]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();
		return haystack.includes(q.toLowerCase());
	};

	const filteredAlerts = $derived.by(() => {
		let list = appState.alerts;

		if (selectedFacilityId !== 'all') {
			list = list.filter((a: Alert) => {
				const device = appState.devices.find((d: Device) => d.id === a.dev_eui);
				return device?.facilityId === selectedFacilityId;
			});
		}

		if (selectedLocationId !== 'all') {
			list = list.filter((a: Alert) => {
				const device = appState.devices.find((d: Device) => d.id === a.dev_eui);
				return device?.locationId === selectedLocationId;
			});
		}

		return list;
	});

	const filteredDevices = $derived.by(() => {
		let list = appState.devices;

		if (selectedFacilityId !== 'all') {
			list = list.filter((d: Device) => d.facilityId === selectedFacilityId);
		}

		if (selectedLocationId !== 'all') {
			list = list.filter((d: Device) => d.locationId === selectedLocationId);
		}

		return list;
	});

	const total = $derived(filteredDevices?.length);
	const alerts = $derived(filteredAlerts?.length);
	const activeAlerts = $derived(filteredAlerts?.filter((a: Alert) => a.is_triggered).length);
	const offline = $derived(filteredDevices?.filter((d: Device) => d.status === 'offline').length);
	const statusCounts = $derived.by(() => {
		const counts: Record<DeviceStatus, number> = {
			online: 0,
			offline: 0,
			loading: 0,
			alert: 0,
		};

		for (const device of filteredDevices ?? []) {
			counts[device.status] = (counts[device.status] ?? 0) + 1;
		}

		return counts;
	});

	// Reactive donut chart data based on actual device status counts
	const statusData = $derived<DonutSegment[]>([
		{ label: 'Devices Online', value: statusCounts.online, color: '#10b981' },
		{ label: 'Devices Offline', value: statusCounts.offline, color: '#ef4444' },
		{ label: 'Active Alerts', value: filteredAlerts.filter((a) => a.is_triggered).length, color: '#f59e0b' },
		{ label: 'Loading...', value: statusCounts.loading, color: '#64748b' }
	]);

	const facilityBreakdown = $derived.by(() => {
		const counts: Record<string, { name: string; count: number }> = {};

		for (const device of filteredDevices ?? []) {
			const key = device.facilityId ?? 'unknown';
			const facility = getFacility(device.facilityId);
			const existing = counts[key];
			if (existing) {
				existing.count += 1;
			} else {
				counts[key] = { name: facility?.name ?? 'Unknown facility', count: 1 };
			}
		}

		return Object.values(counts).sort((a, b) => b.count - a.count);
	});

	const temperatureStats = $derived.by(() => {
		const temps = (filteredDevices ?? [])
			.map((d: Device) => d.temperatureC)
			.filter((t): t is number => typeof t === 'number' && !Number.isNaN(t));

		if (!temps.length) return null;

		const min = Math.min(...temps);
		const max = Math.max(...temps);
		const avg = temps.reduce((sum, t) => sum + t, 0) / temps.length;
		return { min, max, avg };
	});

	const humidityStats = $derived.by(() => {
		const values = (filteredDevices ?? [])
			.map((d: Device) => d.humidity)
			.filter((h): h is number => typeof h === 'number' && !Number.isNaN(h));

		if (!values.length) return null;

		const min = Math.min(...values);
		const max = Math.max(...values);
		const avg = values.reduce((sum, h) => sum + h, 0) / values.length;
		return { min, max, avg };
	});

	const statusOptions = STATUS_TYPES?.map((s) => ({
		value: s,
		label: statusConfig[s].label
	}));

	const statusBadges = STATUS_TYPES.reduce<
		Record<string, { label: string; dotClass: string; badgeClass: string }>
	>((acc, key) => {
		const cfg = statusConfig[key];
		acc[key] = { label: cfg.label, dotClass: cfg.dotClass, badgeClass: cfg.badgeClass };
		return acc;
	}, {});

	const tableColumns = [
		{ key: 'name', label: 'Device', type: 'stacked', secondaryKey: 'id', sortable: true },
		{ key: 'temperatureC', label: 'Temp', type: 'number', suffix: ' °C', sortable: true },
		{ key: 'humidity', label: 'Humidity', type: 'number', suffix: ' %RH', sortable: true },
		{ key: 'co2', label: 'CO₂', type: 'number', suffix: ' ppm', sortable: true },
		{
			key: 'status',
			label: 'Status',
			type: 'badge',
			sortable: true,
			sortOrder: ['alert', 'offline', 'online', 'loading'],
			filter: {
				type: 'checkbox',
				options: statusOptions
			},
			badges: statusBadges
		},
		{ key: 'lastSeen', label: 'Last seen', type: 'datetime', sortable: true },
		{
			key: 'facilityName',
			label: 'Facility / Location',
			type: 'stacked',
			secondaryKey: 'locationName',
			sortable: true,
			href: (item: Device) =>
				`/locations/location/${item.locationId}?prev=${window.location.pathname}`
		},
		{
			key: 'Actions',
			label: 'Actions',
			type: 'buttons',
			cellClass: 'items-center justify-center',
			buttons: [
				{
					label: 'View',
					onClick: (item: Device) => {
						tableLoading = true;
						goto(`/locations/location/${item.locationId}/devices/device/${item.id}?prev=${window.location.pathname}`);
					}
				}
			]
		}
	];

	const tableRows = $derived(
		filteredDevices?.map((d: Device) => {
			const facility = getFacility(d.facilityId);
			const location = getLocation(d.locationId);
			return {
				...d,
				facilityName: facility?.name ?? 'Unknown facility',
				locationName: location?.name ?? 'Unknown location'
			};
		})
	);

	let stopRealtime: (() => void) | null = null;

	onMount(async () => {
		stopRealtime = await startDeviceRealtime(appState);
	});

	onDestroy(() => {
		if (stopRealtime) stopRealtime();
	});
</script>

<svelte:head>
	<title>Dashboard - CropWatch Temp</title>
</svelte:head>

<div class="flex h-screen min-h-0 overflow-hidden bg-slate-950 text-slate-50">
	<!-- Main content -->
	<main class="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950">
		<!-- Top toolbar -->
		<header class="flex-none border-b border-slate-800 bg-slate-950/90 backdrop-blur">
			<div class="flex items-center justify-between px-6 py-3">
				<div class="flex flex-col gap-1">
					<div class="flex items-center gap-2 text-xs text-slate-400">
						<span>Facility</span>
						<span class="text-slate-600">/</span>
						<span class="truncate">
							{selectedFacilityId === 'all'
								? 'All facilities'
								: (getFacility(selectedFacilityId)?.name ?? 'Unknown')}
						</span>
						{#if selectedLocationId !== 'all'}
							<span class="text-slate-600">/</span>
							<span class="truncate">
								{getLocation(selectedLocationId)?.name ?? 'Unknown location'}
							</span>
						{/if}
					</div>
					<h1 class="text-base font-semibold text-slate-50">Temperature & humidity devices</h1>
				</div>

				<div class="flex items-center gap-3 text-xs">
					<div
						class="flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300 ring-1 ring-emerald-500/30"
					>
						<span class="h-2 w-2 rounded-full bg-emerald-400"></span>
						<span>Online</span>
					</div>
					<div
						class="flex items-center gap-1 rounded-full bg-rose-500/10 px-3 py-1 text-rose-300 ring-1 ring-rose-500/30"
					>
						<span class="h-2 w-2 rounded-full bg-rose-400"></span>
						<span>Offline</span>
					</div>
					<div
						class="flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-amber-300 ring-1 ring-amber-500/30"
					>
						<span class="h-2 w-2 rounded-full bg-amber-400"></span>
						<span>Alert</span>
					</div>
				</div>
			</div>

			<div
				class="flex flex-row items-center justify-between gap-3 border-t border-slate-800 px-6 py-3 text-xs"
			>
				<div class="flex flex-wrap items-center gap-3 text-slate-400">
					<span class="flex items-center gap-1">
						<span class="font-mono text-slate-100">{total}</span>
						<span>devices in view</span>
					</span>
					<span class="flex items-center gap-1 text-amber-200">
						<span class="font-mono">{activeAlerts}</span>
						<span>with active alerts</span>
					</span>
					<span class="flex items-center gap-1 text-rose-300">
						<span class="font-mono">{offline}</span>
						<span>offline</span>
					</span>
				</div>
				<span class="flex flex-1"></span>
				<div id="Dashboard__Overview__actions" class="flex items-center gap-3">
					<CWButton variant="secondary" onclick={() => window.location.reload()}>
						<img src={REFRESH_ICON} alt="Refresh Icon" class="h-4 w-4" />
						Refresh
					</CWButton>
					<CWPill value={activeAlerts} color="error" pulse position="bottom-right">
						<CWButton
							variant="secondary"
							size="sm"
							onclick={() => (showAlertPanel.value.open = !showAlertPanel.value.open)}
						>
							<img src={NOTIFICATIONS_ICON} alt="Notifications Icon" />
						</CWButton>
					</CWPill>
				</div>
			</div>
		</header>

		<!-- Device table -->
		<section class="flex-1 min-h-0 overflow-hidden">
			<div class="flex h-full min-h-0 flex-col overflow-hidden px-6 pb-6 pt-2">
				<!-- Device Table -->
				<div
					class="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 mb-2"
				>
					<svelte:boundary>
						<CWTable
							items={tableRows}
							columns={tableColumns}
							filterFn={(item, q) => deviceMatchesSearch(item as Device, q)}
							storageKey="cwtable_header_filters"
							pageSize={12}
							rowHeight={64}
							loading={tableLoading}
							class="h-full flex-1 text-sm"
							virtual={tableRows?.length > 30}
						/>

						{#snippet failed(error, reset)}
							<div class="flex flex-col items-center justify-center py-12 text-center">
								<div
									class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-900/30"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-8 w-8 text-rose-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
										/>
									</svg>
								</div>
								<p class="text-rose-300 font-medium">Failed to load device table</p>
								<p class="mt-1 text-sm text-slate-400">
									{(error as Error)?.message || 'An unexpected error occurred'}
								</p>
								<button
									onclick={reset}
									class="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors"
								>
									Try again
								</button>
							</div>
						{/snippet}
					</svelte:boundary>
				</div>

				<svelte:boundary>
					<CWResizablePanel
						bind:open={showAlertPanel.value.open}
						title="Alerts"
						minHeight={180}
						maxHeight={600}
						defaultHeight={600}
					>
						<div class="grid gap-4 lg:grid-cols-3 sm:grid-cols-2">
							<div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm">
								<div class="flex items-center justify-between text-xs text-slate-400">
									<span>Status mix</span>
									<span class="text-slate-200">Total {total}</span>
								</div>
								<!-- <div
								class="mt-4 flex h-28 items-center justify-center rounded-lg border border-slate-800/70 bg-slate-900/60"
							> -->
								<!-- <div class="text-center">
									<div class="text-3xl font-semibold text-slate-50">{total ?? 0}</div>
									<div class="text-xs text-slate-400">devices tracked</div>
								</div> -->
								<svelte:boundary>
									<CWDonutChart
										data={statusData}
										size={180}
										thickness={0.4}
										centerSubLabel="Devices"
										legendPosition="right"
									/>

									{#snippet failed(error, reset)}
										<div class="flex flex-col items-center justify-center py-6 text-center">
											<div
												class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-900/30"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-6 w-6 text-rose-400"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													stroke-width="2"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
													/>
												</svg>
											</div>
											<p class="text-rose-300 text-sm font-medium">Chart error</p>
											<button
												onclick={reset}
												class="mt-2 text-xs text-slate-400 hover:text-slate-200">Try again</button
											>
										</div>
									{/snippet}
								</svelte:boundary>
								<!-- </div> -->
								<!-- <div class="mt-3 flex h-10 overflow-hidden rounded-lg ring-1 ring-slate-800/80">
								{#if total}
									{#each STATUS_TYPES as status (status)}
										{#if statusCounts[status]}
											<div
												class={`h-full ${statusConfig[status].dotClass} opacity-80`}
												style={`width: ${(statusCounts[status] / total) * 100}%`}
											></div>
										{/if}
									{/each}
								{:else}
									<div class="flex-1 bg-slate-800/60"></div>
								{/if}
							</div> -->
								<!-- <div class="mt-3 flex flex-wrap gap-3 text-xs text-slate-300">
								{#each STATUS_TYPES as status (status)}
									<div class="flex items-center gap-1">
										<span class={`h-2 w-2 rounded-full ${statusConfig[status].dotClass}`}></span>
										<span class="font-mono text-slate-100">{statusCounts[status] ?? 0}</span>
										<span>{statusConfig[status].label}</span>
									</div>
								{/each}
							</div> -->
							</div>

							<div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm">
								<div class="flex items-center justify-between text-xs text-slate-400">
									<span>Top facilities</span>
									<span class="text-slate-200">In view</span>
								</div>
								<div class="mt-3 space-y-2 text-xs text-slate-200">
									{#if facilityBreakdown.length === 0}
										<p class="text-slate-400">No devices available.</p>
									{:else}
										{#each facilityBreakdown.slice(0, 4) as facility, index (`${facility.name}-${index}`)}
											<div class="flex flex-col gap-1">
												<div class="flex items-center justify-between">
													<span class="truncate">{facility.name}</span>
													<span class="font-mono text-slate-100">{facility.count}</span>
												</div>
												<div class="h-2 overflow-hidden rounded bg-slate-800/70">
													<div
														class="h-full rounded bg-gradient-to-r from-emerald-400 to-cyan-500"
														style={`width: ${
															(facility.count /
																Math.max(1, facilityBreakdown[0]?.count ?? facility.count)) *
															100
														}%`}
													></div>
												</div>
											</div>
										{/each}
									{/if}
								</div>
							</div>

							<div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm">
								<div class="flex items-center justify-between text-xs text-slate-400">
									<span>Active Alert List</span>
									<span class="text-slate-200">Reported Time</span>
								</div>
								<div class="mt-3 space-y-2 text-xs text-slate-200">
									{#if filteredAlerts.filter((d) => d.is_triggered).length === 0}
										<p class="text-slate-400">No active alerts.</p>
									{:else}
										{#each filteredAlerts.filter((d) => d.is_triggered) as alert (alert.id)}
											<div class="flex items-center justify-between">
												<span class="truncate">
													<img
														src={ACTIVE_ALERT_ICON}
														alt="Alert Icon"
														class="inline h-7 w-7 mr-1"
													/>
													{alert.name}
												</span>
												<span class="font-mono text-slate-100">
													{new Date(alert.created_at).toLocaleString()}
												</span>
											</div>
										{/each}
									{/if}
								</div>
							</div>
						</div>
					</CWResizablePanel>

					{#snippet failed(error, reset)}
						<div class="rounded-xl border border-slate-800 bg-slate-900 p-6">
							<div class="flex flex-col items-center justify-center py-8 text-center">
								<div
									class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-900/30"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-8 w-8 text-rose-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
										/>
									</svg>
								</div>
								<p class="text-rose-300 font-medium">Failed to load alerts panel</p>
								<p class="mt-1 text-sm text-slate-400">
									{(error as Error)?.message || 'An unexpected error occurred'}
								</p>
								<button
									onclick={reset}
									class="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors"
								>
									Try again
								</button>
							</div>
						</div>
					{/snippet}
				</svelte:boundary>
			</div>
		</section>
	</main>
</div>
