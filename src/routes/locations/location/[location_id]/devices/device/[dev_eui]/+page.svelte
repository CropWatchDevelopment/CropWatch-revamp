<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import DeviceHeatmap from '$lib/components/DeviceHeatmap.svelte';
	import { fetchDeviceHistory } from '$lib/data/SourceOfTruth.svelte';
	import type { Device } from '$lib/Interfaces/device.interface';
	import type { DeviceDataHistory } from '$lib/Interfaces/deviceDataHistory.interface';
	import { getContext, onMount } from 'svelte';
	import type { AppState } from '$lib/Interfaces/appState.interface';
	import type { PageData } from './$types';
	import CWButton from '$lib/components/CWButton.svelte';
	import { goto } from '$app/navigation';
	import BACK_ICON from '$lib/images/icons/back.svg';
	import SETTINGS_ICON from '$lib/images/icons/settings.svg';
	import CWCopy from '$lib/components/CWCopy.svelte';

	const getAppState = getContext<AppState>('appState');
	let appState = $derived(getAppState());
	let { data }: { data: PageData } = $props();

	let device: Device | undefined = $derived(
		appState.devices.find((d: Device) => d.id === page.params.dev_eui)
	);

let history: DeviceDataHistory[] = $state([]);
	let historyLoading = $state(true);
	let historyError: string | null = $state(null);

if (data.initialHistory?.length) {
	history = data.initialHistory.map((p) => ({
		timestamp: p.timestamp || new Date().toISOString(),
		temperature: p.primary ?? 0,
		humidity: p.secondary ?? 0,
		co2: p.co2 ?? null,
		alert: false
	}));
	historyLoading = false;
}

	onMount(async () => {
		if (history.length) return;
		historyLoading = true;
		historyError = null;
		try {
			const { points } = await fetchDeviceHistory({
				devEui: page.params.dev_eui,
				limit: 2000,
				hoursBack: 24
			});

			if (points.length) {
				history = points.map((p) => ({
					timestamp: p.timestamp || new Date().toISOString(),
					temperature: p.primary ?? 0,
					humidity: p.secondary ?? 0,
					co2: p.co2 ?? null,
					alert: false
				}));
			} else if (device) {
				history = [
					{
						timestamp: device.lastSeen,
						temperature: device.temperatureC,
						humidity: device.humidity,
						co2: device.co2 ?? null,
						alert: device.hasAlert
					}
				];
			}
		} catch (err) {
			console.error(err);
			historyError = 'Unable to load historical data';
		} finally {
			historyLoading = false;
		}
	});

	const latestReading = $derived.by(() => {
		const latest = history[0];
		return {
			temperature: latest?.temperature ?? device?.temperatureC ?? 0,
			humidity: latest?.humidity ?? device?.humidity ?? 0,
			timestamp: latest?.timestamp ?? new Date().toISOString(),
			alert: latest?.alert ?? false
		};
	});

	const chronologicalHistory = $derived([...history].reverse());
	const sortedHistory = $derived(
		[...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
	);

	const temperatureValues = $derived(history.map((entry) => entry.temperature));
	const humidityValues = $derived(history.map((entry) => entry.humidity));
	const co2Values = $derived(history.map((entry) => entry.co2 ?? 0));

	function summarize(values: number[]) {
		if (!values.length) return { high: 0, low: 0, avg: 0, stdDeviation: 0 };
		const high = Math.max(...values);
		const low = Math.min(...values);
		const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
		const variance =
			values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
		const stdDeviation = Math.sqrt(variance);

		return { high, low, avg, stdDeviation };
	}

	function median(values: number[]) {
		if (!values.length) return 0;
		const sorted = [...values].sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);
		return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
	}

	const temperatureStats = $derived(summarize(temperatureValues));
	const humidityStats = $derived(summarize(humidityValues));
	const co2Stats = $derived(summarize(co2Values));
	const temperatureMedian = $derived(median(temperatureValues));
	const humidityMedian = $derived(median(humidityValues));
	const co2Median = $derived(median(co2Values));
	const readingCount = $derived(history.length);
	const temperatureDelta = $derived.by(() =>
		history[1] ? latestReading.temperature - history[1].temperature : 0
	);
	const humidityDelta = $derived.by(() =>
		history[1] ? latestReading.humidity - history[1].humidity : 0
	);

	const baseMetricCards = $derived.by(() => [
		{
			key: 'temperature',
			label: 'Temperature',
			unit: '°C',
			current: latestReading.temperature,
			delta: temperatureDelta,
			min: temperatureStats.low,
			max: temperatureStats.high,
			avg: temperatureStats.avg,
			median: temperatureMedian,
			stdDeviation: temperatureStats.stdDeviation,
			range: temperatureStats.high - temperatureStats.low,
			count: readingCount,
			palette: {
				accent: 'text-amber-400',
				bar: 'bg-amber-400/70',
				knob: 'bg-amber-400',
				badge: 'text-amber-300'
			}
		},
		{
			key: 'humidity',
			label: 'Humidity',
			unit: '%',
			current: latestReading.humidity,
			delta: humidityDelta,
			min: humidityStats.low,
			max: humidityStats.high,
			avg: humidityStats.avg,
			median: humidityMedian,
			stdDeviation: humidityStats.stdDeviation,
			range: humidityStats.high - humidityStats.low,
			count: readingCount,
			palette: {
				accent: 'text-sky-400',
				bar: 'bg-sky-400/70',
				knob: 'bg-sky-400',
				badge: 'text-sky-300'
			}
		},
		{
			key: 'co2',
			label: 'CO₂',
			unit: 'ppm',
			current: history[0]?.co2 ?? device?.co2 ?? 0,
			delta: history[1] ? (history[0]?.co2 ?? 0) - (history[1]?.co2 ?? 0) : 0,
			min: co2Stats.low,
			max: co2Stats.high,
			avg: co2Stats.avg,
			median: co2Median,
			stdDeviation: co2Stats.stdDeviation,
			range: co2Stats.high - co2Stats.low,
			count: readingCount,
			palette: {
				accent: 'text-emerald-300',
				bar: 'bg-emerald-400/70',
				knob: 'bg-emerald-400',
				badge: 'text-emerald-200'
			}
		}
	]);

	const metricCards = $derived.by(() =>
		baseMetricCards.map((card) => {
			const padding = Math.max(0.5, card.range * 0.15 || 0.5);
			const scaleMin = card.min - padding;
			const scaleMax = card.max + padding;

			return {
				...card,
				scaleMin,
				scaleMax,
				positions: {
					min: toPercent(card.min, scaleMin, scaleMax),
					avg: toPercent(card.avg, scaleMin, scaleMax),
					max: toPercent(card.max, scaleMin, scaleMax),
					current: toPercent(card.current, scaleMin, scaleMax)
				}
			};
		})
	);

	const alertCount = $derived(history.filter((entry) => entry.alert).length);

	function toPercent(value: number, min: number, max: number) {
		if (max - min === 0) return 50;
		return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
	}

	const heatmapRange = $derived.by(() => {
		if (!history.length) return 'No history';
		const newest = history[0]?.timestamp;
		const oldest = history[history.length - 1]?.timestamp;
		if (!newest || !oldest) return 'History range';
		const fmt = new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZoneName: 'short'
		});
		return `${fmt.format(new Date(oldest))} → ${fmt.format(new Date(newest))}`;
	});

	const heatmapPalette = {
		temperature: ['bg-sky-900', 'bg-sky-800', 'bg-sky-700', 'bg-sky-600', 'bg-rose-500'],
		humidity: ['bg-slate-800', 'bg-teal-700', 'bg-teal-500', 'bg-teal-400', 'bg-cyan-300'],
		co2: ['bg-slate-800', 'bg-lime-800', 'bg-lime-600', 'bg-amber-500', 'bg-red-500']
	};

	const formatter = new Intl.DateTimeFormat('en', {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'UTC'
	});

	const heatmapSeries = $derived.by(() => ({
		temperature: {
			key: 'temperature',
			label: 'Temp',
			unit: '°C',
			palette: heatmapPalette.temperature,
			points: chronologicalHistory.map((entry) => ({
				label: formatHour(entry.timestamp),
				value: entry.temperature,
				alert: entry.alert
			}))
		},
		humidity: {
			key: 'humidity',
			label: 'Humidity',
			unit: '%',
			palette: heatmapPalette.humidity,
			points: chronologicalHistory.map((entry) => ({
				label: formatHour(entry.timestamp),
				value: entry.humidity,
				alert: entry.alert
			}))
		},
		co2: {
			key: 'co2',
			label: 'CO₂',
			unit: 'ppm',
			palette: heatmapPalette.co2,
			points: chronologicalHistory.map((entry) => ({
				label: formatHour(entry.timestamp),
				value: entry.co2 ?? 0,
				alert: entry.alert
			}))
		}
	}));

	function formatHour(timestamp: string) {
		return formatter.format(new Date(timestamp));
	}
</script>

<div class="flex flex-col gap-8 p-6 text-slate-100">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-row w-full items-center gap-3">
			<CWButton
				variant="primary"
				onclick={() => {
					goto(resolve(page.url.searchParams.get('prev') ?? '/locations'));
				}}
			>
				<img src={BACK_ICON} alt="Edit device" class="h-4 w-4" />
				Back
			</CWButton>

			<span class="flex flex-grow"></span>

			<CWButton
				variant="secondary"
				onclick={() => {
					goto(`${page.url.pathname}/settings?prev=${page.url.pathname}`);
				}}
			>
				<img src={SETTINGS_ICON} alt="Go back" class="h-4 w-4" />
				Settings
			</CWButton>
		</div>
	</div>

	<header
		class="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-slate-950/40"
	>
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="text-xs uppercase tracking-[0.2em] text-slate-500">Temperature sensor</p>
				<h1 class="mt-1 text-3xl font-semibold text-white">Cold Chain TH-01</h1>
				<p class="text-sm text-slate-400">
					Device EUI • 
					<CWCopy value="70-B3-D5-43-0F-12" size="sm" />
				</p>
			</div>
			<div class="text-right text-sm text-slate-400">
				<p>Location: Freezer Aisle 01</p>
				<p>Facility: Miyazaki Processing Plant</p>
				<p>Updated: {formatHour(latestReading.timestamp)} UTC</p>
			</div>
		</div>
	</header>

	<section class="grid gap-4 lg:grid-cols-2">
		{#each metricCards as card (card.key)}
			<div
				class="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-slate-950/50"
			>
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p class="text-xs uppercase tracking-[0.3em] text-slate-500">{card.label}</p>
						<div class="mt-2 flex items-baseline gap-3">
							<p class="text-4xl font-semibold text-white">
								{card.current.toFixed(1)}{card.unit}
							</p>
							<span
								class={`text-sm font-semibold ${card.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
							>
								{card.delta >= 0 ? '▲' : '▼'}
								{Math.abs(card.delta).toFixed(1)}{card.unit}
							</span>
						</div>
					</div>
					<div class="text-right text-xs leading-relaxed text-slate-400">
						<p>Count: {card.count}</p>
						<p>Range: {card.range.toFixed(2)}{card.unit}</p>
						<p>Std dev: {card.stdDeviation.toFixed(2)}{card.unit}</p>
					</div>
				</div>

				<div class="mt-4 grid grid-cols-3 gap-3 text-center border-t border-slate-600 pt-4">
					<div>
						<p class="text-xs uppercase tracking-wide text-slate-500">Min</p>
						<p class="text-lg font-semibold text-slate-100">
							{card.min.toFixed(2)}{card.unit}
						</p>
					</div>
					<div>
						<p class="text-xs uppercase tracking-wide text-slate-500">Avg</p>
						<p class={`text-lg font-semibold ${card.palette.accent}`}>
							{card.avg.toFixed(2)}{card.unit}
						</p>
					</div>
					<div>
						<p class="text-xs uppercase tracking-wide text-slate-500">Max</p>
						<p class="text-lg font-semibold text-slate-100">
							{card.max.toFixed(2)}{card.unit}
						</p>
					</div>
				</div>

				<div class="mt-4">
					<div class="relative h-2 rounded-full bg-slate-900">
						<div
							class={`absolute h-full rounded-full ${card.palette.bar}`}
							style={`left:${card.positions.min}%; right:${100 - card.positions.max}%;`}
						></div>
						<span
							class="absolute -top-1.5 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-slate-950 bg-white/70"
							style={`left:${card.positions.min}%;`}
						></span>
						<span
							class={`absolute -top-2 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white/40 ${card.palette.knob} shadow-lg shadow-black/40`}
							style={`left:${card.positions.avg}%;`}
						></span>
						<span
							class="absolute -top-1.5 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-slate-950 bg-white/70"
							style={`left:${card.positions.max}%;`}
						></span>
						<span
							class="absolute top-3 -translate-x-1/2 text-[10px] font-semibold text-white"
							style={`left:${card.positions.current}%;`}
						>
							Now
						</span>
					</div>
				</div>

				<div class="mt-6 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
					<p>
						<span class="text-slate-500">Median:</span>
						<span class={`ml-2 font-semibold ${card.palette.badge}`}>
							{card.median.toFixed(2)}{card.unit}
						</span>
					</p>
					<p>
						<span class="text-slate-500">Range:</span>
						<span class="ml-2 font-semibold text-slate-100">{card.range.toFixed(2)}{card.unit}</span
						>
					</p>
					<p>
						<span class="text-slate-500">Alerts:</span>
						<span
							class={`ml-2 font-semibold ${alertCount ? 'text-amber-300' : 'text-emerald-300'}`}
						>
							{alertCount}
						</span>
					</p>
					<p>
						<span class="text-slate-500">Central value:</span>
						<span class="ml-2 font-semibold text-slate-100"
							>{card.median.toFixed(2)}{card.unit}</span
						>
					</p>
				</div>
			</div>
		{/each}
	</section>

	{#if historyLoading}
		<p class="mt-4 text-sm text-slate-400">Loading historical data…</p>
	{:else if historyError}
		<p class="mt-4 text-sm text-amber-300">{historyError}</p>
	{/if}

	<DeviceHeatmap
		title="Thermal footprint"
		subtitle="Past 24 hours"
		metrics={heatmapSeries}
		dateRange={heatmapRange}
	/>

	<section
		class="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-slate-950/40"
	>
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="text-xs uppercase tracking-[0.2em] text-slate-500">24h history</p>
				<h2 class="text-xl font-semibold text-white">All telemetry points</h2>
			</div>
			<div class="text-sm text-slate-400">{sortedHistory.length} samples</div>
		</div>

		<div class="mt-4 overflow-hidden rounded-2xl border border-slate-800">
			<table class="w-full text-sm">
				<thead class="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
					<tr>
						<th class="px-4 py-3 text-left">Timestamp (UTC)</th>
						<th class="px-4 py-3 text-left">Temperature</th>
						<th class="px-4 py-3 text-left">CO₂</th>
						<th class="px-4 py-3 text-left">Humidity</th>
						<th class="px-4 py-3 text-left">Alert</th>
						<th class="px-4 py-3 text-left">Notes</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedHistory as entry, index (entry.timestamp)}
						{@const isAlert = entry.alert}
						<tr
							class={`${
								isAlert
									? 'bg-amber-500/10 text-amber-100'
									: index % 2 === 0
										? 'bg-slate-900/60'
										: 'bg-slate-900/30'
							} border-b border-slate-900/40`}
						>
							<td class="px-4 py-3 font-mono text-xs text-slate-200">
								{formatHour(entry.timestamp)}
							</td>
							<td class="px-4 py-3 font-semibold text-white">{entry.temperature.toFixed(1)}°C</td>
							<td class="px-4 py-3 text-slate-100">
								{#if entry.co2 != null}
									{entry.co2}
								{:else}
									—
								{/if}
							</td>
							<td class="px-4 py-3 text-slate-100">{entry.humidity}%</td>
							<td class="px-4 py-3">
								<span
									class={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
										isAlert
											? 'bg-amber-400/20 text-amber-100'
											: 'bg-emerald-500/10 text-emerald-200'
									}`}
								>
									{isAlert ? 'Alert' : 'Normal'}
								</span>
							</td>
							<td class="px-4 py-3 text-slate-200">{entry.note ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
