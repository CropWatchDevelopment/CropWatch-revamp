<script lang="ts">
	type HeatmapPoint = { label: string; value: number; alert?: boolean; className?: string };
	type HeatmapMetric = {
		key: string;
		label: string;
		unit: string;
		palette: string[];
		points: HeatmapPoint[];
	};

	let {
		title = 'Thermal footprint',
		subtitle = '',
		dateRange = '',
		metrics
	}: {
		title?: string;
		subtitle?: string;
		dateRange?: string;
		metrics: Record<string, HeatmapMetric>;
	} = $props();

	let selectedMetric = $state(Object.keys(metrics ?? {})[0] ?? '');

	const metricEntries = $derived.by(() => Object.entries(metrics ?? {}));

	const activeMetric = $derived.by(
		() => (selectedMetric && metrics?.[selectedMetric]) || metricEntries[0]?.[1]
	);

	const activeValues = $derived.by(() => activeMetric?.points?.map((point) => point.value) ?? []);

	const scale = $derived.by(() => {
		if (!activeValues.length) return { min: 0, max: 0, range: 1 };
		const min = Math.min(...activeValues);
		const max = Math.max(...activeValues);

		return { min, max, range: Math.max(1, max - min) };
	});

	const heatmapData = $derived.by(() => {
		if (!activeMetric) return [];
		const palette = activeMetric.palette?.length ? activeMetric.palette : ['bg-slate-800'];

		return activeMetric.points.map((point) => {
			const normalized = (point.value - scale.min) / scale.range;
			const index = Math.min(
				palette.length - 1,
				Math.max(0, Math.round(normalized * (palette.length - 1)))
			);

			return { ...point, className: palette[index] };
		});
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
				<div class="flex overflow-hidden rounded-full border border-slate-600">
					{#each metricEntries as [key, metric] (key)}
						<label
							class={`cursor-pointer px-4 py-2 text-sm font-medium transition ${
								selectedMetric === key
									? 'bg-slate-700 text-white'
									: 'bg-transparent text-slate-500'
							}`}
						>
							<input class="sr-only" type="radio" value={key} bind:group={selectedMetric} />
							{metric.label}
						</label>
					{/each}
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
		{/if}
	</div>

	{#if activeMetric && heatmapData.length}
		<div class="mt-6 space-y-4">
			<div class="grid grid-cols-12 gap-1">
				{#each heatmapData as cell (cell.label)}
					<div
						class={`relative aspect-[4/3] rounded-lg ${cell.className} ${
							cell.alert ? 'ring-2 ring-amber-400' : 'ring-1 ring-slate-900/30'
						}`}
						title={`${cell.label} — ${cell.value}${activeMetric.unit}`}
					>
						<span class="absolute inset-x-1 bottom-1 text-[10px] font-medium text-white/80">
							{cell.value}{activeMetric.unit}
						</span>
					</div>
				{/each}
			</div>
			<div class="flex items-center justify-between text-xs text-slate-500">
				<span>Start</span>
				<div class="flex items-center gap-1">
					<span class={`h-3 w-3 rounded ${activeMetric.palette[0] ?? 'bg-slate-700'}`}></span>
					<span>cool</span>
					<span
						class={`h-3 w-3 rounded ${
							activeMetric.palette[activeMetric.palette.length - 1] ?? 'bg-rose-500'
						}`}
					></span>
					<span>hot</span>
				</div>
				<span>End</span>
			</div>
		</div>
	{:else}
		<p class="mt-4 text-sm text-slate-400">No data available.</p>
	{/if}
</section>
