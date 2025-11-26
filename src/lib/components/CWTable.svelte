<script lang="ts">
	import { onMount } from 'svelte';

	type SortDir = 'asc' | 'desc';
	type FilterFn<T> = (item: T, search: string) => boolean;
	type SortFn<T> = (a: T, b: T, key: string, dir: SortDir) => number;
	type RowIdFn<T> = (item: T, index: number) => string | number;

	type ColumnFilterOption = { value: string; label?: string };
	type ColumnFilter = { type: 'checkbox'; options: ColumnFilterOption[] };

	type BadgeEntry = { label?: string; dotClass?: string; badgeClass?: string };
	type ColumnConfig = {
		key: string;
		label: string;
		value?: string;
		secondaryKey?: string;
		type?: 'text' | 'number' | 'datetime' | 'stacked' | 'badge';
		suffix?: string;
		align?: 'left' | 'center' | 'right';
		sortable?: boolean;
		sortOrder?: string[];
		badges?: Record<string, BadgeEntry>;
		filter?: ColumnFilter;
		width?: string;
		cellClass?: string;
	};

	const defaultFilter: FilterFn<unknown> = (item, search) => {
		if (!search.trim()) return true;
		const lowered = search.toLowerCase();
		return JSON.stringify(item ?? '')
			.toLowerCase()
			.includes(lowered);
	};

	const defaultSort: SortFn<unknown> = (a, b, key, dir) => {
		const left = (a as Record<string, unknown>)[key];
		const right = (b as Record<string, unknown>)[key];
		const dirMul = dir === 'asc' ? 1 : -1;

		if (typeof left === 'number' && typeof right === 'number') {
			return (left - right) * dirMul;
		}

		return String(left ?? '').localeCompare(String(right ?? '')) * dirMul;
	};

	const defaultRowId: RowIdFn<unknown> = (item, index) =>
		(item as { id?: string | number })?.id ?? index;

	const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

	let {
		items = [],
		columns = [],
		storageKey = null,
		filterFn = defaultFilter,
		sortFn = defaultSort,
		getRowId = defaultRowId,
		rowHeight = 52,
		viewportHeight = 520,
		header,
		row,
		actions,
		empty,
		pageSize = $bindable(15),
		page = $bindable(1),
		search = $bindable(''),
		sortKey = $bindable(''),
		sortDir = $bindable<SortDir>('asc'),
		virtual = $bindable(false),
		class: className = ''
	} = $props();

	const columnMap = $derived.by(() => {
		const map: Record<string, ColumnConfig> = {};
		for (const col of columns) map[col.key] = col;
		return map;
	});

	const buildDefaultFilters = () => {
		const defaults: Record<string, string[]> = {};
		for (const col of columns) {
			if (col.filter?.type === 'checkbox') {
				defaults[col.key] = col.filter.options.map((o) => o.value);
			}
		}
		return defaults;
	};

	let columnFilters = $state<Record<string, string[]>>(buildDefaultFilters());
	let pendingColumnFilters = $state<Record<string, string[]>>(buildDefaultFilters());
	let pendingSortKey = $state<string>(sortKey || (columns[0]?.key ?? ''));
	let pendingSortDir = $state<SortDir>(sortDir);
	let openColumn = $state<string | null>(null);

	let scrollTop = $state(0);
	let scroller: HTMLDivElement | null = null;
	let containerHeight = $state(viewportHeight);

	const setColumnFilters = (value: Record<string, string[]>) => {
		columnFilters = value;
	};

	const setPendingFilters = (value: Record<string, string[]>) => {
		pendingColumnFilters = value;
	};

	const loadFromStorage = () => {
		if (!storageKey || typeof localStorage === 'undefined') return;
		const raw = localStorage.getItem(storageKey);
		if (!raw) return;
		try {
			const parsed = JSON.parse(raw) as {
				sortKey?: string;
				sortDir?: SortDir;
				filters?: Record<string, string[]>;
			};
			if (parsed.sortKey) sortKey = parsed.sortKey;
			if (parsed.sortDir) sortDir = parsed.sortDir;
			const defaults = buildDefaultFilters();
			const merged: Record<string, string[]> = { ...defaults };
			if (parsed.filters) {
				for (const col of columns) {
					const saved = parsed.filters[col.key];
					const defaultOptions = defaults[col.key];
					if (saved && saved.length > 0) {
						merged[col.key] = saved;
					} else {
						merged[col.key] = defaultOptions ?? [];
					}
				}
			}
			setColumnFilters(merged);
			setPendingFilters(merged);
		} catch (err) {
			console.warn('Failed to read table state', err);
		}
	};

	const saveToStorage = () => {
		if (!storageKey || typeof localStorage === 'undefined') return;
		const payload = JSON.stringify({
			sortKey,
			sortDir,
			filters: columnFilters
		});
		localStorage.setItem(storageKey, payload);
	};

	onMount(() => {
		loadFromStorage();
		if (!sortKey && columns.length) {
			sortKey = columns[0].key;
		}
	});

	const getColumnValue = (item: unknown, col: ColumnConfig) => {
		const record = item as Record<string, unknown>;
		if (col.value) return record[col.value];
		return record[col.key];
	};

	const applyColumnFilters = (list: unknown[]) => {
		return list.filter((item) => {
			for (const col of columns) {
				const active = columnFilters[col.key];
				if (col.filter?.type === 'checkbox' && active?.length) {
					const value = String(getColumnValue(item, col) ?? '');
					if (!active.includes(value)) return false;
				}
			}
			return true;
		});
	};

	let tableItems = $derived.by(() => items ?? []);
	let filtered = $derived.by(() =>
		applyColumnFilters(tableItems.filter((i) => filterFn(i, search)))
	);

	const columnSort = (a: unknown, b: unknown, key: string, dir: SortDir) => {
		const col = columnMap[key];
		if (!col) return sortFn(a, b, key, dir);
		const dirMul = dir === 'asc' ? 1 : -1;
		const left = getColumnValue(a, col);
		const right = getColumnValue(b, col);

		const order = col.sortOrder ?? col.filter?.options?.map((o) => o.value);
		if (order) {
			return (order.indexOf(String(left)) - order.indexOf(String(right))) * dirMul;
		}

		if (col.type === 'number') {
			return ((Number(left) || 0) - (Number(right) || 0)) * dirMul;
		}
		if (col.type === 'datetime') {
			return (new Date(left as string).getTime() - new Date(right as string).getTime()) * dirMul;
		}
		return String(left ?? '').localeCompare(String(right ?? '')) * dirMul;
	};

	let sorted = $derived.by(() => {
		if (!sortKey) return [...filtered];
		return [...filtered].sort((a, b) => columnSort(a, b, sortKey, sortDir));
	});

	let total = $derived(sorted.length);
	let pageCount = $derived(Math.max(1, Math.ceil(total / pageSize)));

	$effect(() => {
		if (virtual) return;
		if (page < 1) page = 1;
		if (page > pageCount) page = pageCount;
	});

	let paginated = $derived.by(() => {
		if (virtual) return sorted;
		const start = (page - 1) * pageSize;
		return sorted.slice(start, start + pageSize);
	});

	let startIndex = $derived(virtual ? Math.max(0, Math.floor(scrollTop / rowHeight)) : 0);
	let visibleCount = $derived(virtual ? Math.ceil(containerHeight / rowHeight) + 2 : pageSize);

	let visibleRows = $derived.by(() => {
		if (!virtual) return paginated;
		const end = Math.min(sorted.length, startIndex + visibleCount);
		return sorted.slice(startIndex, end);
	});

	let topSpacer = $derived(virtual ? startIndex * rowHeight : 0);
	let bottomSpacer = $derived(
		virtual
			? Math.max(sorted.length * rowHeight - topSpacer - visibleRows.length * rowHeight, 0)
			: 0
	);

	const handleScroll = () => {
		if (!scroller) return;
		scrollTop = scroller.scrollTop;
	};

	const setScrollerRef = (node: HTMLDivElement) => {
		scroller = node;
		return () => {
			if (scroller === node) {
				scroller = null;
			}
		};
	};

	const setSort = (key: string) => {
		if (key === sortKey) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'asc';
		}
		saveToStorage();
	};

	const sortIcon = (key: string) => {
		if (key !== sortKey) return '';
		return sortDir === 'asc' ? '↑' : '↓';
	};

	const goToPage = (next: number) => {
		if (virtual) return;
		page = clamp(next, 1, pageCount);
	};

	const nextPage = () => goToPage(page + 1);
	const prevPage = () => goToPage(page - 1);

	const setPageSize = (size: number) => {
		if (size < 1) return;
		pageSize = size;
		if (!virtual) page = 1;
	};

	const toggleVirtual = () => {
		virtual = !virtual;
		if (virtual && scroller) scroller.scrollTop = 0;
	};

	const setSearch = (value: string) => {
		search = value;
		if (virtual && scroller) scroller.scrollTop = 0;
	};

	$effect(() => {
		visibleRows;
		if (virtual && scroller && scrollTop > scroller.scrollHeight) {
			scroller.scrollTop = 0;
		}
	});

	const visibleStart = $derived(
		virtual ? Math.min(total, startIndex + 1) : Math.min(total, (page - 1) * pageSize + 1)
	);
	const visibleEnd = $derived(
		virtual
			? Math.min(total, startIndex + visibleRows.length)
			: Math.min(total, (page - 1) * pageSize + paginated.length)
	);

	const tableContext = $derived.by(() => ({
		sortKey,
		sortDir,
		search,
		page,
		pageSize,
		pageCount,
		total,
		useVirtual: virtual,
		visibleStart,
		visibleEnd,
		startIndex,
		hasActions: Boolean(actions),
		actions,
		setSort,
		sortIcon,
		goToPage,
		nextPage,
		prevPage,
		setPageSize,
		setSearch,
		toggleVirtual
	}));

	const toggleOption = (colKey: string, value: string) => {
		const next = { ...pendingColumnFilters };
		const current = next[colKey] ?? [];
		const exists = current.includes(value);
		next[colKey] = exists ? current.filter((v) => v !== value) : [...current, value];
		setPendingFilters(next);
	};

	const applyPending = () => {
		setColumnFilters({ ...pendingColumnFilters });
		sortKey = pendingSortKey;
		sortDir = pendingSortDir;
		openColumn = null;
		saveToStorage();
	};

	const savePending = () => {
		applyPending();
		saveToStorage();
	};

	const closeDropdown = () => {
		openColumn = null;
		setPendingFilters({ ...columnFilters });
		pendingSortKey = sortKey;
		pendingSortDir = sortDir;
	};

	const alignClass = (align?: string) => {
		if (align === 'right') return 'text-right';
		if (align === 'center') return 'text-center';
		return 'text-left';
	};
</script>

<div class={`cw-table flex h-full w-full flex-col text-xs text-slate-200 ${className}`}>
	<div
		class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-3"
	>
		<div class="flex items-center gap-2">
			<label class="text-slate-400" for="table-search">Search</label>
			<div class="relative">
				<input
					id="table-search"
					value={search}
					oninput={(event) => setSearch(event.currentTarget.value)}
					class="w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none ring-1 ring-slate-800 focus:border-sky-500 focus:ring-sky-500"
					placeholder="Search rows..."
				/>
				{#if search}
					<button
						class="absolute inset-y-0 right-2 text-slate-500 hover:text-slate-300"
						type="button"
						onclick={() => setSearch('')}
						aria-label="Clear search"
					>
						✕
					</button>
				{/if}
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<button
				type="button"
				class={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] transition ${
					virtual
						? 'border-sky-500/70 bg-sky-500/10 text-sky-200'
						: 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600'
				}`}
				onclick={toggleVirtual}
			>
				<span class={`h-2 w-2 rounded-full ${virtual ? 'bg-sky-400' : 'bg-slate-500'}`}></span>
				<span>{virtual ? 'Virtual scroll' : 'Paginated'}</span>
			</button>

			<label class="flex items-center gap-2 text-slate-400">
				<span>Page size</span>
				<select
					class="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
					onchange={(event) => setPageSize(Number(event.currentTarget.value))}
					value={pageSize}
				>
					<option value="10">10</option>
					<option value="12">12</option>
					<option value="15">15</option>
					<option value="25">25</option>
					<option value="50">50</option>
				</select>
			</label>

			<div class="text-slate-400">
				Showing {visibleStart}–{visibleEnd} of {total}
			</div>
		</div>
	</div>

	<div class="relative flex min-h-0 flex-1">
		<div
			class="flex h-full w-full overflow-auto"
			{@attach setScrollerRef}
			onscroll={virtual ? handleScroll : undefined}
			bind:clientHeight={containerHeight}
			style={virtual ? `max-height:${viewportHeight}px` : ''}
		>
			<table class="min-w-full text-xs text-slate-100">
				<thead class="sticky top-0 bg-slate-900/90 text-slate-300 backdrop-blur">
					{#if header}
						{@render header(tableContext)}
					{:else if columns.length}
						<tr class="border-b border-slate-800 text-[11px] uppercase tracking-wide">
							{#each columns as col (col.key)}
								<th class={`relative px-3 py-2 ${alignClass(col.align)}`} style={col.width ?? ''}>
									<button
										class="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-slate-800/80"
										onclick={() => {
											if (openColumn === col.key) {
												closeDropdown();
											} else {
												openColumn = col.key;
												pendingSortKey = col.key;
												pendingSortDir = sortDir;
												setPendingFilters({ ...columnFilters });
											}
										}}
									>
										<span>{col.label}</span>
										{#if col.sortable !== false}
											<span>{sortIcon(col.key)}</span>
										{/if}
										{#if col.filter}
											<span class="text-slate-500">▾</span>
										{/if}
									</button>

									{#if openColumn === col.key}
										<div
											class="absolute left-0 z-30 mt-2 w-64 rounded-lg border border-slate-700 bg-slate-900 p-3 text-[12px] shadow-xl ring-1 ring-slate-800"
										>
											<div class="mb-2 text-[11px] font-semibold uppercase text-slate-400">
												Sort order
											</div>
											<div class="mb-3 space-y-1">
												<label class="flex items-center gap-2 text-slate-200">
													<input
														type="radio"
														name={`sort-${col.key}`}
														value="asc"
														checked={pendingSortDir === 'asc'}
														onchange={() => {
															pendingSortKey = col.key;
															pendingSortDir = 'asc';
														}}
													/>
													<span>Ascending</span>
												</label>
												<label class="flex items-center gap-2 text-slate-200">
													<input
														type="radio"
														name={`sort-${col.key}`}
														value="desc"
														checked={pendingSortDir === 'desc'}
														onchange={() => {
															pendingSortKey = col.key;
															pendingSortDir = 'desc';
														}}
													/>
													<span>Descending</span>
												</label>
											</div>

											{#if col.filter?.type === 'checkbox'}
												<div class="mb-2 text-[11px] font-semibold uppercase text-slate-400">
													Types
												</div>
												<div class="space-y-1">
													{#each col.filter.options as opt (opt.value)}
														<label
															class="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-slate-800/70"
														>
															<div class="flex items-center gap-2">
																<input
																	type="checkbox"
																	checked={pendingColumnFilters[col.key]?.includes(opt.value)}
																	onchange={() => toggleOption(col.key, opt.value)}
																/>
																<span class="capitalize text-slate-100"
																	>{opt.label ?? opt.value}</span
																>
															</div>
														</label>
													{/each}
												</div>
											{/if}

											<div
												class="mt-3 flex items-center justify-end gap-2 border-t border-slate-800 pt-3 text-[11px]"
											>
												<button
													class="rounded-md bg-slate-800 px-3 py-1 text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700"
													onclick={applyPending}
												>
													OK
												</button>
												<button
													class="rounded-md bg-sky-600 px-3 py-1 text-slate-950 ring-1 ring-sky-500 hover:bg-sky-500"
													onclick={savePending}
												>
													SAVE
												</button>
												<button
													class="rounded-md bg-slate-800 px-3 py-1 text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700"
													onclick={closeDropdown}
												>
													Close
												</button>
											</div>
										</div>
									{/if}
								</th>
							{/each}
							{#if actions}
								<th class="px-3 py-2 text-right">Actions</th>
							{/if}
						</tr>
					{:else}
						<tr class="border-b border-slate-800 text-[11px] uppercase tracking-wide">
							<th class="px-3 py-2 text-left">Items</th>
							{#if actions}
								<th class="px-3 py-2 text-right">Actions</th>
							{/if}
						</tr>
					{/if}
				</thead>

				<tbody>
					{#if total === 0}
						{#if empty}
							{@render empty(tableContext)}
						{:else}
							<tr>
								<td
									colspan={actions ? columns.length + 1 : columns.length || 1}
									class="px-4 py-10 text-center text-sm text-slate-500"
								>
									No results match the current filters.
								</td>
							</tr>
						{/if}
					{:else if virtual}
						{#if topSpacer > 0}
							<tr aria-hidden="true" style={`height:${topSpacer}px`}></tr>
						{/if}

						{#if row}
							{#each visibleRows as item, idx (getRowId(item, startIndex + idx))}
								{@render row(item, startIndex + idx, tableContext)}
							{/each}
						{:else}
							{#each visibleRows as item, idx (getRowId(item, startIndex + idx))}
								<tr class="border-t border-slate-900/80">
									{#if columns.length}
										{#each columns as col (col.key)}
											<td
												class={`px-3 py-2 align-middle ${alignClass(col.align)} ${col.cellClass ?? ''}`}
												style={col.width ?? ''}
											>
												{#if col.type === 'badge' && col.badges}
													{@const raw = getColumnValue(item, col)}
													{@const badge = col.badges[String(raw)]}
													{#if badge}
														<div class="flex items-center gap-2">
															{#if badge.dotClass}
																<span class={`h-2 w-2 rounded-full ${badge.dotClass}`}></span>
															{/if}
															<span
																class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${badge.badgeClass ?? ''}`}
															>
																{badge.label ?? String(raw)}
															</span>
														</div>
													{:else}
														<span>{String(raw ?? '')}</span>
													{/if}
												{:else if col.type === 'stacked'}
													{@const primary = getColumnValue(item, col)}
													{@const secondary = (item as Record<string, unknown>)[
														col.secondaryKey ?? ''
													]}
													<div class="flex flex-col text-left">
														<span class="text-slate-50">{primary}</span>
														{#if secondary}
															<span class="text-[11px] text-slate-500">{secondary}</span>
														{/if}
													</div>
												{:else if col.type === 'datetime'}
													{@const raw = getColumnValue(item, col)}
													<span class="font-mono text-[11px] text-slate-400">
														{raw ? new Date(raw as string).toLocaleString() : ''}
													</span>
												{:else}
													{@const raw = getColumnValue(item, col)}
													{#if col.type === 'number'}
														<span class="font-mono text-[13px] text-slate-50">
															{Number(raw).toLocaleString()}{col.suffix ?? ''}
														</span>
													{:else}
														<span class="text-slate-50">
															{raw}{col.suffix ?? ''}
														</span>
													{/if}
												{/if}
											</td>
										{/each}
										{#if actions}
											<td class="whitespace-nowrap px-3 py-2 align-middle text-right">
												{@render actions(item, startIndex + idx, tableContext)}
											</td>
										{/if}
									{:else}
										<td class="px-3 py-2 text-slate-200">
											<pre class="text-xs text-slate-400">{JSON.stringify(item, null, 2)}</pre>
										</td>
									{/if}
								</tr>
							{/each}
						{/if}

						{#if bottomSpacer > 0}
							<tr aria-hidden="true" style={`height:${bottomSpacer}px`}></tr>
						{/if}
					{:else if row}
						{#each paginated as item, idx (getRowId(item, (page - 1) * pageSize + idx))}
							{@render row(item, (page - 1) * pageSize + idx, tableContext)}
						{/each}
					{:else}
						{#each paginated as item, idx (getRowId(item, (page - 1) * pageSize + idx))}
							<tr class="border-t border-slate-900/80 even:bg-slate-900/50">
								{#if columns.length}
									{#each columns as col (col.key)}
										<td
											class={`px-3 align-middle ${alignClass(col.align)} ${col.cellClass ?? ''}`}
											style={col.width ?? ''}
										>
											{#if col.type === 'badge' && col.badges}
												{@const raw = getColumnValue(item, col)}
												{@const badge = col.badges[String(raw)]}
												{#if badge}
													<div class="flex items-center gap-2">
														{#if badge.dotClass}
															<span class={`h-2 w-2 rounded-full ${badge.dotClass}`}></span>
														{/if}
														<span
															class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${badge.badgeClass ?? ''}`}
														>
															{badge.label ?? String(raw)}
														</span>
													</div>
												{:else}
													<span>{String(raw ?? '')}</span>
												{/if}
											{:else if col.type === 'stacked'}
												{@const primary = getColumnValue(item, col)}
												{@const secondary = (item as Record<string, unknown>)[
													col.secondaryKey ?? ''
												]}
												<div class="flex flex-col text-left">
													<span class="text-slate-50">{primary}</span>
													{#if secondary}
														<span class="text-[11px] text-slate-500">{secondary}</span>
													{/if}
												</div>
											{:else if col.type === 'datetime'}
												{@const raw = getColumnValue(item, col)}
												<span class="font-mono text-[11px] text-slate-400">
													{raw ? new Date(raw as string).toLocaleString() : ''}
												</span>
											{:else}
												{@const raw = getColumnValue(item, col)}
												{#if col.type === 'number'}
													<span class="font-mono text-[13px] text-slate-50">
														{Number(raw).toLocaleString()}{col.suffix ?? ''}
													</span>
												{:else}
													<span class="text-slate-50">
														{raw}{col.suffix ?? ''}
													</span>
												{/if}
											{/if}
										</td>
									{/each}
									{#if actions}
										<td class="whitespace-nowrap px-3 align-middle text-right">
											{@render actions(item, (page - 1) * pageSize + idx, tableContext)}
										</td>
									{/if}
								{:else}
									<td class="px-3 text-slate-200">
										<pre class="text-xs text-slate-400">{JSON.stringify(item, null, 2)}</pre>
									</td>
								{/if}
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
	<span class="flex-grow"></span>
	<div
		class="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 px-4 py-3"
	>
		<div class="flex items-center gap-2 text-[11px] text-slate-200">
			<button
				type="button"
				class="rounded-md bg-slate-900 px-2 py-1 text-slate-200 ring-1 ring-slate-700 transition enabled:hover:bg-slate-800 disabled:opacity-50"
				onclick={prevPage}
				disabled={page === 1 || virtual}
			>
				Prev
			</button>
			<span class="text-slate-400">
				Page {page} of {pageCount}
			</span>
			<button
				type="button"
				class="rounded-md bg-slate-900 px-2 py-1 text-slate-200 ring-1 ring-slate-700 transition enabled:hover:bg-slate-800 disabled:opacity-50"
				onclick={nextPage}
				disabled={page === pageCount || virtual}
			>
				Next
			</button>
		</div>

		<div class="text-[11px] text-slate-400">
			{#if virtual}
				<span>Virtualized list • {total} rows</span>
			{:else}
				<span>
					Rows {visibleStart}–{visibleEnd} of {total}
				</span>
			{/if}
		</div>
	</div>
</div>
