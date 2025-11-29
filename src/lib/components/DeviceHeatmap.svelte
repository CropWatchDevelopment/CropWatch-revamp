<script lang="ts">
	import CWDateRangePicker, { type DateRangeValue } from './CWDateRangePicker.svelte';
	import { DateTime } from 'luxon';

	type HeatmapPoint = { label: string; value: number; alert?: boolean; className?: string };
	type HeatmapMetric = {
		key: string;
		label: string;
		unit: string;
		palette?: string[];
		points: HeatmapPoint[];
	};

	let {
		title = 'Thermal footprint',
		subtitle = '',
		dateRange = { start: DateTime.now().startOf('day').toJSDate(), end: new Date() },
		metrics
	}: {
		title?: string;
		subtitle?: string;
		dateRange?: DateRangeValue;
		metrics: Record<string, HeatmapMetric>;
	} = $props();

	let selectedMetric = $state(Object.keys(metrics ?? {})[0] ?? '');
	let hoveredIndex = $state<number | null>(null);

	const metricEntries = $derived.by(() => Object.entries(metrics ?? {}));

	const activeMetric = $derived.by(
		() => (selectedMetric && metrics?.[selectedMetric]) || metricEntries[0]?.[1]
	);

	const activeValues = $derived.by(() => activeMetric?.points?.map((point) => point.value) ?? []);

	const scale = $derived.by(() => {
		if (!activeValues.length) return { min: 0, max: 0, avg: 0, range: 1 };
		const min = Math.min(...activeValues);
		const max = Math.max(...activeValues);
		const avg = activeValues.reduce((sum, v) => sum + v, 0) / activeValues.length;
		return { min, max, avg, range: Math.max(1, max - min) };
	});

	// Compute a blue-to-red color based on deviation from the average.
	// Values at avg are neutral slate/gray, colder skews toward blue, warmer skews toward red.
	function tempToColor(value: number, min: number, max: number, avg: number): string {
		const range = Math.max(1, max - min);
		// -1 = coldest, 0 = avg, +1 = hottest
		const deviation = (value - avg) / (range / 2);
		const clamped = Math.max(-1, Math.min(1, deviation));

		// Blend from blue (#3b82f6) through neutral (#475569) to red (#ef4444)
		let r: number, g: number, b: number;
		if (clamped <= 0) {
			// cold → neutral
			const t = clamped + 1; // 0 = blue, 1 = neutral
			r = Math.round(59 + t * (71 - 59));
			g = Math.round(130 + t * (85 - 130));
			b = Math.round(246 + t * (105 - 246));
		} else {
			// neutral → hot
			const t = clamped; // 0 = neutral, 1 = red
			r = Math.round(71 + t * (239 - 71));
			g = Math.round(85 + t * (68 - 85));
			b = Math.round(105 + t * (68 - 105));
		}
		return `rgb(${r}, ${g}, ${b})`;
	}

	const heatmapData = $derived.by(() => {
		if (!activeMetric) return [];
		return activeMetric.points.map((point) => {
			const color = tempToColor(point.value, scale.min, scale.max, scale.avg);
			return { ...point, color };
		});
	});

	const xTicks = $derived.by(() => {
		const len = activeMetric?.points?.length ?? 0;
		if (!len) return [];
		const count = Math.min(6, len);
		return Array.from({ length: count }, (_, i) => Math.round((len - 1) * (i / (count - 1))));
	});

	// Generate legend swatches from cold → avg → hot
	const legendSwatches = $derived.by(() => {
		const steps = 7;
		const swatches: string[] = [];
		for (let i = 0; i < steps; i++) {
			const t = i / (steps - 1);
			const val = scale.min + t * scale.range;
			swatches.push(tempToColor(val, scale.min, scale.max, scale.avg));
		}
		return swatches;
	});
</script>

<section class="rounded-3xl border border-slate-800 bg-[#21213c] p-6 shadow-lg shadow-slate-950/40">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<p class="text-xs uppercase tracking-[0.15em] text-slate-500">{title}</p>
			{#if subtitle}
				<h2 class="text-xl font-semibold text-white">{subtitle}</h2>
			{/if}
		</div>

		{#if metricEntries.length}
			<div class="flex flex-wrap items-center gap-3">
				<label
					class="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-200"
				>
					<span class="text-xs uppercase tracking-wide text-slate-500">Range</span>
					<CWDateRangePicker maxDate={new Date()} bind:value={dateRange} />
				</label>
				<div class="flex overflow-hidden rounded-full border border-slate-600">
					{#each metricEntries as [key, metric] (key)}
						<label
							class={`cursor-pointer px-4 py-2 text-sm font-medium transition ${
								selectedMetric === key ? 'bg-slate-700 text-white' : 'bg-transparent text-slate-500'
							}`}
						>
							<input class="sr-only" type="radio" value={key} bind:group={selectedMetric} />
							{metric.label}
						</label>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	{#if activeMetric && heatmapData.length}
		<div class="mt-6 flex flex-col gap-4">
			<div class="flex items-stretch gap-3">
				<div
					class="heatmap-grid grid flex-1 gap-[3px] rounded-xl border border-slate-800 bg-slate-900/70 p-3"
					style="grid-template-columns: repeat(auto-fill, minmax(24px, 1fr)); grid-auto-rows: 24px;"
				>
					{#each heatmapData as cell, idx (idx)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class={`heatmap-cell relative cursor-pointer rounded-md shadow-sm ${
								cell.alert ? 'ring-2 ring-amber-400' : ''
							} ${hoveredIndex === idx ? 'hovered' : ''}`}
							style={`background-color: ${cell.color};`}
							title={`${cell.label} — ${cell.value}${activeMetric.unit}`}
							onmouseenter={() => (hoveredIndex = idx)}
							onmouseleave={() => (hoveredIndex = null)}
						>
							<span
								class="cell-value pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white drop-shadow-md"
							>
								{cell.value.toFixed(1)}
							</span>
						</div>
					{/each}
				</div>

				<div
					class="flex w-16 flex-col items-center justify-between gap-1 text-[10px] text-slate-300"
				>
					<span class="text-xs font-medium text-rose-400">Hot</span>
					<div
						class="flex w-full flex-1 flex-col overflow-hidden rounded border border-slate-700 shadow-inner"
					>
						{#each [...legendSwatches].reverse() as color, i (color + i)}
							<span class="flex-1" style={`background-color: ${color};`}></span>
						{/each}
					</div>
					<span class="text-xs font-medium text-sky-400">Cold</span>
					<div class="mt-1 w-full space-y-0.5 text-center text-[11px] text-slate-400">
						<div class="text-rose-300">{scale.max.toFixed(1)}{activeMetric.unit}</div>
						<div class="text-slate-500">avg {scale.avg.toFixed(1)}</div>
						<div class="text-sky-300">{scale.min.toFixed(1)}{activeMetric.unit}</div>
					</div>
				</div>
			</div>

			<div class="flex items-center justify-between text-[11px] text-slate-400">
				<span>0</span>
				<div class="relative flex-1">
					<div class="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-800"></div>
					<div class="relative flex justify-between px-[6px]">
						{#each xTicks as tick (tick)}
							<span class="relative -mt-1 flex flex-col items-center">
								<span class="h-2 w-px bg-slate-600"></span>
								<span class="mt-1 text-[10px] text-slate-300">{tick}</span>
							</span>
						{/each}
					</div>
				</div>
				<span>{Math.max(1, heatmapData.length - 1)}</span>
			</div>
		</div>
	{:else}
		<p class="mt-4 text-sm text-slate-400">No data available.</p>
	{/if}
</section>

<style>
	.heatmap-cell {
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease,
			z-index 0s;
		z-index: 1;
	}

	.heatmap-cell.hovered {
		transform: scale(1.6);
		z-index: 20;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	}

	.cell-value {
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.heatmap-cell.hovered .cell-value {
		opacity: 1;
	}
</style>
