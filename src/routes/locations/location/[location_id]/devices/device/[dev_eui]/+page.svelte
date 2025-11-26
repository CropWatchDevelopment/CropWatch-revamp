<script lang="ts">
	import { page } from '$app/state';
	import type { Device } from '$lib/Interfaces/device.interface';
	import type { DeviceDataHistory } from '$lib/Interfaces/deviceDataHistory.interface';
	import type { Facility } from '$lib/Interfaces/facility.interface';

	let { data } = $props<{
		data: {
			facilities: Facility[];
			locations: Location[];
			devices: Device[];
		};
	}>();

	const device = data?.devices?.find((d: Device) => d.id === page.params.dev_eui);

	type MetricOption = 'temperature' | 'humidity';

	const baseTimestamp = new Date('2025-11-26T06:00:00Z').getTime();

	const history: DeviceDataHistory[] = Array.from({ length: 24 }, (_, index) => {
		const ts = new Date(baseTimestamp - index * 60 * 60 * 1000);
		const sineSeed = Math.sin((Math.PI * (24 - index)) / 12);
		const temp = parseFloat((-2.5 + sineSeed * 7).toFixed(1));
		const humidity = Math.round(
			55 + Math.cos((Math.PI * (24 - index)) / 9) * 12 + (index % 5 === 0 ? 6 : 0)
		);
		const alert = temp < -8 || temp > 6 || humidity > 78;

		return {
			timestamp: ts.toISOString(),
			temperature: temp,
			humidity,
			alert,
			note: alert ? 'Threshold exceeded' : undefined
		};
	});

	const latestReading = history[0];
	const chronologicalHistory = [...history].reverse();
	const sortedHistory = [...history].sort(
		(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
	);

	const temperatureValues = history.map((entry) => entry.temperature);
	const humidityValues = history.map((entry) => entry.humidity);

	function summarize(values: number[]) {
		const high = Math.max(...values);
		const low = Math.min(...values);
		const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
		const variance =
			values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
		const stdDeviation = Math.sqrt(variance);

		return { high, low, avg, stdDeviation };
	}

	function median(values: number[]) {
		const sorted = [...values].sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);
		return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
	}

	const temperatureStats = summarize(temperatureValues);
	const humidityStats = summarize(humidityValues);
	const temperatureMedian = median(temperatureValues);
	const humidityMedian = median(humidityValues);
	const readingCount = history.length;
	const temperatureDelta = history[1] ? latestReading.temperature - history[1].temperature : 0;
	const humidityDelta = history[1] ? latestReading.humidity - history[1].humidity : 0;

	const baseMetricCards = [
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
		}
	];

	const metricCards = baseMetricCards.map((card) => {
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
	});

	const statCards = [
		{
			label: 'Temp · 24h HIGH',
			value: `${temperatureStats.high.toFixed(1)}°C`
		},
		{
			label: 'Temp · 24h LOW',
			value: `${temperatureStats.low.toFixed(1)}°C`
		},
		{
			label: 'Temp · 24h Average',
			value: `${temperatureStats.avg.toFixed(1)}°C`
		},
		{
			label: 'Temp · Std deviation',
			value: `${temperatureStats.stdDeviation.toFixed(2)}°C`
		},
		{
			label: 'Humidity · 24h HIGH',
			value: `${humidityStats.high.toFixed(1)}%`
		},
		{
			label: 'Humidity · 24h LOW',
			value: `${humidityStats.low.toFixed(1)}%`
		},
		{
			label: 'Humidity · 24h Average',
			value: `${humidityStats.avg.toFixed(1)}%`
		},
		{
			label: 'Humidity · Std deviation',
			value: `${humidityStats.stdDeviation.toFixed(2)}%`
		}
	];

	const alertCount = history.filter((entry) => entry.alert).length;

	function toPercent(value: number, min: number, max: number) {
		if (max - min === 0) return 50;
		return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
	}

	let heatmapMetric = $state<MetricOption>('temperature');
	let dateRange = $state('Nov 25, 06:00 → Nov 26, 06:00 (UTC)');

	const heatmapPalette = {
		temperature: ['bg-sky-900', 'bg-sky-800', 'bg-sky-700', 'bg-sky-600', 'bg-rose-500'],
		humidity: ['bg-slate-800', 'bg-teal-700', 'bg-teal-500', 'bg-teal-400', 'bg-cyan-300']
	};

	function getHeatColor(value: number, metric: MetricOption) {
		const stats = metric === 'temperature' ? temperatureStats : humidityStats;
		const palette = heatmapPalette[metric];
		const normalized = (value - stats.low) / Math.max(1, stats.high - stats.low);
		const index = Math.min(
			palette.length - 1,
			Math.max(0, Math.round(normalized * (palette.length - 1)))
		);
		return palette[index];
	}

	const formatter = new Intl.DateTimeFormat('en', {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'UTC'
	});

	function formatHour(timestamp: string) {
		return formatter.format(new Date(timestamp));
	}

	const heatmapData = $derived.by(() =>
		chronologicalHistory.map((entry) => {
			const value = heatmapMetric === 'temperature' ? entry.temperature : entry.humidity;
			return {
				label: formatHour(entry.timestamp),
				value,
				alert: entry.alert,
				className: getHeatColor(value, heatmapMetric)
			};
		})
	);
</script>

<div class="flex flex-col gap-8 p-6 text-slate-100">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<a
			href={`${page.url.searchParams.get('prev') ?? '/locations'}`}
			class="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-700 hover:bg-slate-900"
		>
			<span aria-hidden="true">←</span>
			Back to locations
		</a>
		<div class="flex items-center gap-3">
			<div class="hidden text-xs uppercase tracking-wide text-slate-400 md:block">
				Device detail
			</div>
			<a
				href="/settings?prev={page.url.pathname}"
				class="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-700 hover:bg-slate-900"
			>
				<span class="text-xs">⚙</span>
				Settings
			</a>
		</div>
	</div>

	<header
		class="rounded-3xl border border-slate-800 bg-[#21213c] p-6 shadow-lg shadow-slate-950/40"
	>
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="text-xs uppercase tracking-[0.2em] text-slate-500">Temperature sensor</p>
				<h1 class="mt-1 text-3xl font-semibold text-white">Cold Chain TH-01</h1>
				<p class="text-sm text-slate-400">Device EUI • 70-B3-D5-43-0F-12</p>
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
				class="rounded-3xl border border-slate-800 bg-[#21213c] p-6 shadow-lg shadow-slate-950/50"
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

	<section
		class="rounded-3xl border border-slate-800 bg-[#21213c] p-6 shadow-lg shadow-slate-950/40"
	>
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="text-xs uppercase tracking-[0.15em] text-slate-500">Thermal footprint</p>
				<h2 class="text-xl font-semibold text-white">Past 24 hours</h2>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<div class="flex overflow-hidden rounded-full border border-slate-600">
					<label
						class={`cursor-pointer px-4 py-2 text-sm font-medium transition ${
							heatmapMetric === 'temperature'
								? 'bg-slate-700 text-white'
								: 'bg-transparent text-slate-500'
						}`}
					>
						<input class="sr-only" type="radio" value="temperature" bind:group={heatmapMetric} />
						Temp
					</label>
					<label
						class={`cursor-pointer px-4 py-2 text-sm font-medium transition ${
							heatmapMetric === 'humidity'
								? 'bg-slate-700 text-white'
								: 'bg-transparent text-slate-500'
						}`}
					>
						<input class="sr-only" type="radio" value="humidity" bind:group={heatmapMetric} />
						Humidity
					</label>
				</div>
				<label
					class="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-200"
				>
					<span class="text-xs uppercase tracking-wide text-slate-500">Range</span>
					<input
						class="w-60 bg-transparent text-right text-sm text-slate-100 outline-none"
						type="text"
						bind:value={dateRange}
						placeholder="Select date range"
					/>
				</label>
			</div>
		</div>

		<div class="mt-6 space-y-4">
			<div class="grid grid-cols-12 gap-1">
				{#each heatmapData as cell (cell.label)}
					<div
						class={`relative aspect-[4/3] rounded-lg ${cell.className} ${
							cell.alert ? 'ring-2 ring-amber-400' : 'ring-1 ring-slate-900/30'
						}`}
						title={`${cell.label} — ${cell.value}${heatmapMetric === 'temperature' ? '°C' : '%'}`}
					>
						<span class="absolute inset-x-1 bottom-1 text-[10px] font-medium text-white/80">
							{cell.value}{heatmapMetric === 'temperature' ? '°' : '%'}
						</span>
					</div>
				{/each}
			</div>
			<div class="flex items-center justify-between text-xs text-slate-500">
				<span>24h ago</span>
				<div class="flex items-center gap-1">
					<span class="h-3 w-3 rounded bg-slate-700"></span>
					<span>cool</span>
					<span class="h-3 w-3 rounded bg-rose-500"></span>
					<span>hot</span>
				</div>
				<span>Now</span>
			</div>
		</div>
	</section>

	<section
		class="rounded-3xl border border-slate-800 bg-[#21213c] p-6 shadow-lg shadow-slate-950/40"
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
