<script lang="ts">
	import { resolve } from '$app/paths';
	import CWButton from '$lib/components/CWButton.svelte';
	import CWBackButton from '$lib/components/CWBackButton.svelte';
	import CWTable from '$lib/components/CWTable.svelte';
	import type { PageData } from './$types';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	type ReportItem = (typeof data.reports)[number];

	let selected = $state<number[]>([]);

	const toggleSelect = (id: number) => {
		selected = selected.includes(id) ? selected.filter((i) => i !== id) : [...selected, id];
	};

	const selectAll = () => {
		selected = data.reports.map((r) => r.id);
	};

	const clearSelection = () => {
		selected = [];
	};

	const downloadReport = (report: ReportItem) => {
		// TODO: replace with real download call
		console.log('Download report', report.report_id);
	};

	const bulkDownload = () => {
		const ids = new Set(selected);
		const toDownload = data.reports.filter((r) => ids.has(r.id));
		toDownload.forEach((report) => downloadReport(report));
	};

	const currentPath = $derived($page.url.pathname);

	const reportItems = $derived(
		data.reports.map((report) => ({
			...report,
			device_label: report.device_name ? `${report.device_name} (${report.dev_eui})` : report.dev_eui,
			created_at_fmt: new Date(report.created_at).toLocaleString()
		}))
	);

	const reportColumns = [
		{
			key: 'select',
			label: '',
			width: '40px',
			align: 'center'
		},
		{
			key: 'name',
			label: 'Report',
			type: 'stacked',
			secondaryKey: 'report_id',
			sortable: true,
			href: (item: ReportItem) => resolve(`/reports/${item.report_id}/edit`)
		},
		{
			key: 'device_label',
			label: 'Device',
			value: 'device_label',
			sortable: true,
			href: (item: ReportItem) => {
				if (!item.location_id) return resolve(`/devices/${item.dev_eui}`);
				return resolve(
					`/locations/location/${item.location_id}/devices/device/${item.dev_eui}?prev=${currentPath}`
				);
			}
		},
		{
			key: 'created_at_fmt',
			label: 'Created',
			value: 'created_at_fmt',
			sortable: true
		},
		{
			key: 'actions',
			label: 'Actions',
			type: 'buttons',
			align: 'right',
			buttons: [
				{
					label: 'Download',
					variant: 'ghost',
					onClick: (row: unknown) => downloadReport(row as ReportItem)
				},
				{
					label: 'Edit',
					variant: 'ghost',
					onClick: (row: unknown) => {
						const url = resolve(`/reports/${(row as ReportItem).report_id}/edit`);
						if (typeof window !== 'undefined') window.location.href = url;
					}
				}
			]
		}
	];

	const openReport = (item: ReportItem) => {
		const url = resolve(`/reports/${item.report_id}/edit`);
		if (typeof window !== 'undefined') window.location.href = url;
	};
	const openDevice = (item: ReportItem) => {
		const url = item.location_id
			? resolve(
					`/locations/location/${item.location_id}/devices/device/${item.dev_eui}?prev=${currentPath}`
			  )
			: resolve(`/devices/${item.dev_eui}`);
		if (typeof window !== 'undefined') window.location.href = url;
	};
</script>

<div class="min-h-screen p-6">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div>
			<CWBackButton fallback="/" label="Back to Dashboard" class="mb-2" />
			<p class="text-sm uppercase tracking-wide text-slate-500">Reports</p>
			<h1 class="text-2xl font-semibold text-slate-100">Generated reports</h1>
			<p class="text-sm text-slate-400">
				Browse and download your reports. Use the checkboxes to bulk download.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<CWButton variant="primary" onclick={bulkDownload} disabled={selected.length === 0}>
				Bulk download ({selected.length})
			</CWButton>
			<CWButton variant="ghost" onclick={selectAll}>Select all</CWButton>
			<CWButton variant="ghost" onclick={clearSelection}>Clear</CWButton>
		</div>
	</div>

	<div class="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
		<svelte:boundary>
			<CWTable
				items={reportItems}
				columns={reportColumns}
				storageKey="reports-table"
				pageSize={12}
				class="text-sm"
			>
				{#snippet row(item, idx, ctx)}
					<tr class="border-t border-slate-900/80 even:bg-slate-900/40 hover:bg-slate-800/70">
						<td class="px-2 md:px-3 py-2 text-center">
							<input
								type="checkbox"
								checked={selected.includes(item.id)}
								onchange={() => toggleSelect(item.id)}
								aria-label={`Select report ${item.name}`}
							/>
						</td>
						<td class="px-2 md:px-3 py-2">
							<button
								type="button"
								onclick={() => openReport(item)}
								class="flex flex-col text-left text-slate-50 hover:text-sky-300"
							>
								<span>{item.name}</span>
								<span class="text-[11px] text-slate-500">{item.report_id}</span>
							</button>
						</td>
						<td class="px-2 md:px-3 py-2">
							<button
								type="button"
								onclick={() => openDevice(item)}
								class="flex flex-col text-left text-slate-50 hover:text-sky-300"
							>
								<span>{item.device_name}</span>
								<span class="text-[11px] text-slate-500">{item.dev_eui}</span>
							</button>
						</td>
						<td class="px-2 md:px-3 py-2 text-slate-300">{item.created_at_fmt}</td>
						<td class="px-2 md:px-3 py-2 text-right">
							<div class="flex items-center justify-end gap-2">
								<CWButton variant="ghost" size="sm" onclick={() => downloadReport(item)}>
									Download
								</CWButton>
								<CWButton
									variant="ghost"
									size="sm"
									onclick={() => goto(resolve(`/reports/${item.report_id}/edit`))}
								>
									Edit
								</CWButton>
							</div>
						</td>
					</tr>
				{/snippet}

				{#snippet empty()}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-8 w-8 text-slate-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
								/>
							</svg>
						</div>
						<p class="text-slate-400">No reports yet</p>
						<p class="mt-1 text-sm text-slate-500">Generate a report to see it here.</p>
					</div>
				{/snippet}
			</CWTable>

			{#snippet failed(error, reset)}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-900/30">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					</div>
					<p class="text-rose-300 font-medium">Failed to load reports table</p>
					<p class="mt-1 text-sm text-slate-500">{(error as Error)?.message || 'An unexpected error occurred'}</p>
					<button onclick={reset} class="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors">
						Try again
					</button>
				</div>
			{/snippet}
		</svelte:boundary>
	</div>
</div>
