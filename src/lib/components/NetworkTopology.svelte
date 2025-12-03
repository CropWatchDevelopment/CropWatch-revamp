<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import * as d3 from 'd3';
	import CWDialog from './CWDialog.svelte';
	import CWButton from './CWButton.svelte';

	type GatewayConnection = {
		gateway_id: string;
		gateway_name: string;
		rssi: number | null;
		snr: number | null;
		last_update: string;
	};

	type DeviceInfo = {
		dev_eui: string;
		name: string | null;
		location_id: number | null;
		location_name?: string | null;
		gateways: GatewayConnection[];
	};

	type Gateway = {
		gateway_id: string;
		gateway_name: string;
		is_online: boolean;
		devices: DeviceInfo[];
	};

	type GraphNode = {
		id: string;
		label: string;
		type: 'gateway' | 'device';
		isOnline?: boolean;
		deviceInfo?: DeviceInfo;
		x?: number;
		y?: number;
		fx?: number | null;
		fy?: number | null;
	};

	type GraphLink = {
		source: string | GraphNode;
		target: string | GraphNode;
		rssi?: number | null;
		snr?: number | null;
	};

	interface Props {
		gateways: Gateway[];
		height?: number;
		locationId?: number;
	}

	let { gateways, height = 500, locationId }: Props = $props();

	// Dialog state
	let dialogOpen = $state(false);
	let selectedDevice = $state<DeviceInfo | null>(null);

	let containerEl: HTMLDivElement | undefined = $state();
	let width = $state(800);

	// Build graph data from gateways
	const graphData = $derived.by(() => {
		const nodes: GraphNode[] = [];
		const links: GraphLink[] = [];
		const deviceMap = new SvelteMap<string, DeviceInfo>();

		gateways.forEach((gateway) => {
			// Add gateway node
			nodes.push({
				id: `gw-${gateway.gateway_id}`,
				label: gateway.gateway_name || gateway.gateway_id,
				type: 'gateway',
				isOnline: gateway.is_online
			});

			// Add device nodes and links
			(gateway.devices ?? []).forEach((device) => {
				const deviceId = `dev-${device.dev_eui}`;

				// Merge gateway connection info for devices connected to multiple gateways
				if (!deviceMap.has(device.dev_eui)) {
					deviceMap.set(device.dev_eui, {
						...device,
						gateways: []
					});
				}

				const existingDevice = deviceMap.get(device.dev_eui)!;
				// Add this gateway to the device's gateway list
				const gatewayConn = device.gateways?.find((g) => g.gateway_id === gateway.gateway_id);
				if (gatewayConn) {
					existingDevice.gateways.push(gatewayConn);
				} else {
					existingDevice.gateways.push({
						gateway_id: gateway.gateway_id,
						gateway_name: gateway.gateway_name,
						rssi: null,
						snr: null,
						last_update: ''
					});
				}

				// Add link from gateway to device with signal info
				const connectionInfo = device.gateways?.find((g) => g.gateway_id === gateway.gateway_id);
				links.push({
					source: `gw-${gateway.gateway_id}`,
					target: deviceId,
					rssi: connectionInfo?.rssi ?? null,
					snr: connectionInfo?.snr ?? null
				});
			});
		});

		// Add device nodes after collecting all gateway connections
		deviceMap.forEach((device, dev_eui) => {
			nodes.push({
				id: `dev-${dev_eui}`,
				label: device.name || dev_eui,
				type: 'device',
				deviceInfo: device
			});
		});

		return { nodes, links };
	});

	function handleDeviceClick(deviceInfo: DeviceInfo) {
		selectedDevice = deviceInfo;
		dialogOpen = true;
	}

	function navigateToDevice() {
		if (selectedDevice) {
			const locId = locationId ?? selectedDevice.location_id;
			if (locId) {
				goto(`/locations/location/${locId}/devices/device/${selectedDevice.dev_eui}`);
			}
		}
		dialogOpen = false;
	}

	function getSignalStrengthLabel(rssi: number | null): { label: string; color: string } {
		if (rssi === null) return { label: 'Unknown', color: 'text-slate-400' };
		if (rssi >= -70) return { label: 'Excellent', color: 'text-emerald-400' };
		if (rssi >= -85) return { label: 'Good', color: 'text-sky-400' };
		if (rssi >= -100) return { label: 'Fair', color: 'text-amber-400' };
		return { label: 'Poor', color: 'text-rose-400' };
	}

	function getSignalBars(rssi: number | null): number {
		if (rssi === null) return 0;
		if (rssi >= -70) return 4;
		if (rssi >= -85) return 3;
		if (rssi >= -100) return 2;
		return 1;
	}

	function renderGraph() {
		if (!containerEl || graphData.nodes.length === 0) return;

		// Clear previous content
		d3.select(containerEl).selectAll('*').remove();

		const svg = d3
			.select(containerEl)
			.append('svg')
			.attr('width', '100%')
			.attr('height', height)
			.attr('viewBox', `0 0 ${width} ${height}`);

		// Add zoom behavior
		const g = svg.append('g');
		
		const zoom = d3.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.3, 3])
			.on('zoom', (event) => {
				g.attr('transform', event.transform);
			});

		svg.call(zoom);

		// Define arrow marker for links
		svg
			.append('defs')
			.append('marker')
			.attr('id', 'arrowhead')
			.attr('viewBox', '-0 -5 10 10')
			.attr('refX', 25)
			.attr('refY', 0)
			.attr('orient', 'auto')
			.attr('markerWidth', 6)
			.attr('markerHeight', 6)
			.append('path')
			.attr('d', 'M 0,-5 L 10,0 L 0,5')
			.attr('fill', '#475569');

		// Create force simulation
		const simulation = d3
			.forceSimulation<GraphNode>(graphData.nodes as GraphNode[])
			.force(
				'link',
				d3
					.forceLink<GraphNode, GraphLink>(graphData.links)
					.id((d) => d.id)
					.distance(150)
			)
			.force('charge', d3.forceManyBody().strength(-400))
			.force('center', d3.forceCenter(width / 2, height / 2))
			.force('collision', d3.forceCollide().radius(60));

		// Create links
		const link = g
			.append('g')
			.attr('class', 'links')
			.selectAll('line')
			.data(graphData.links)
			.join('line')
			.attr('stroke', '#475569')
			.attr('stroke-width', 2)
			.attr('stroke-opacity', 0.6)
			.attr('marker-end', 'url(#arrowhead)');

		// Create node groups
		const node = g
			.append('g')
			.attr('class', 'nodes')
			.selectAll<SVGGElement, GraphNode>('g')
			.data(graphData.nodes as GraphNode[])
			.join('g')
			.attr('cursor', 'grab')
			.call(
				d3
					.drag<SVGGElement, GraphNode>()
					.on('start', (event, d) => {
						if (!event.active) simulation.alphaTarget(0.3).restart();
						d.fx = d.x;
						d.fy = d.y;
					})
					.on('drag', (event, d) => {
						d.fx = event.x;
						d.fy = event.y;
					})
					.on('end', (event, d) => {
						if (!event.active) simulation.alphaTarget(0);
						d.fx = null;
						d.fy = null;
					})
			);

		// Gateway nodes (rectangles)
		node
			.filter((d) => d.type === 'gateway')
			.append('rect')
			.attr('width', 140)
			.attr('height', 50)
			.attr('x', -70)
			.attr('y', -25)
			.attr('rx', 8)
			.attr('ry', 8)
			.attr('fill', (d) => (d.isOnline ? '#065f46' : '#881337'))
			.attr('stroke', (d) => (d.isOnline ? '#10b981' : '#f43f5e'))
			.attr('stroke-width', 2);

		// Gateway icon
		node
			.filter((d) => d.type === 'gateway')
			.append('text')
			.attr('x', -55)
			.attr('y', 5)
			.attr('fill', '#e2e8f0')
			.attr('font-size', '16px')
			.text('📡');

		// Gateway label
		node
			.filter((d) => d.type === 'gateway')
			.append('text')
			.attr('x', -35)
			.attr('y', 5)
			.attr('fill', '#e2e8f0')
			.attr('font-size', '12px')
			.attr('font-weight', '500')
			.text((d) => truncateLabel(d.label, 12));

		// Device nodes (circles)
		const deviceNodes = node.filter((d) => d.type === 'device');

		deviceNodes
			.append('circle')
			.attr('r', 28)
			.attr('fill', '#1e293b')
			.attr('stroke', '#0ea5e9')
			.attr('stroke-width', 2)
			.attr('cursor', 'pointer')
			.on('click', (event, d) => {
				event.stopPropagation();
				if (d.deviceInfo) {
					handleDeviceClick(d.deviceInfo);
				}
			});

		// Device icon
		deviceNodes
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('y', -5)
			.attr('fill', '#0ea5e9')
			.attr('font-size', '14px')
			.attr('pointer-events', 'none')
			.text('📦');

		// Device label
		deviceNodes
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('y', 12)
			.attr('fill', '#94a3b8')
			.attr('font-size', '9px')
			.attr('pointer-events', 'none')
			.text((d) => truncateLabel(d.label, 10));

		// Add tooltips
		node.append('title').text((d) => d.label);

		// Update positions on tick
		simulation.on('tick', () => {
			link
				.attr('x1', (d) => (d.source as GraphNode).x ?? 0)
				.attr('y1', (d) => (d.source as GraphNode).y ?? 0)
				.attr('x2', (d) => (d.target as GraphNode).x ?? 0)
				.attr('y2', (d) => (d.target as GraphNode).y ?? 0);

			node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
		});

		// Initial zoom to fit
		setTimeout(() => {
			const bounds = g.node()?.getBBox();
			if (bounds) {
				const fullWidth = width;
				const fullHeight = height;
				const bWidth = bounds.width;
				const bHeight = bounds.height;
				const scale = 0.8 / Math.max(bWidth / fullWidth, bHeight / fullHeight);
				const translate = [
					fullWidth / 2 - scale * (bounds.x + bWidth / 2),
					fullHeight / 2 - scale * (bounds.y + bHeight / 2)
				];
				svg.transition().duration(500).call(
					zoom.transform,
					d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
				);
			}
		}, 500);
	}

	function truncateLabel(label: string, maxLength: number): string {
		if (label.length <= maxLength) return label;
		return label.substring(0, maxLength - 1) + '…';
	}

	// Handle resize
	function handleResize() {
		if (containerEl) {
			width = containerEl.clientWidth;
			renderGraph();
		}
	}

	onMount(() => {
		handleResize();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	// Re-render when gateways data changes
	$effect(() => {
		// Track gateways to trigger re-render when data changes
		const _ = gateways;
		if (containerEl) {
			untrack(() => renderGraph());
		}
	});
</script>

<div
	bind:this={containerEl}
	class="network-topology w-full rounded-xl bg-slate-950 border border-slate-700"
	style="height: {height}px;"
>
	{#if graphData.nodes.length === 0}
		<div class="h-full flex items-center justify-center">
			<div class="text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-16 w-16 mx-auto text-slate-600 mb-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"
					/>
				</svg>
				<p class="text-slate-400">No gateways to display</p>
				<p class="mt-1 text-sm text-slate-400">Add a gateway to see the network topology.</p>
			</div>
		</div>
	{/if}
</div>

<!-- Device Info Dialog -->
<CWDialog bind:open={dialogOpen} title="Device Information">
	{#if selectedDevice}
		<div class="space-y-4">
			<!-- Device Name & ID -->
			<div class="rounded-lg bg-slate-800/50 p-4">
				<div class="flex items-center gap-3">
					<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-500/20">
						<span class="text-2xl">📦</span>
					</div>
					<div class="min-w-0 flex-1">
						<h3 class="font-medium text-slate-100 truncate">
							{selectedDevice.name || 'Unnamed Device'}
						</h3>
						<p class="text-sm text-slate-400 font-mono truncate">{selectedDevice.dev_eui}</p>
					</div>
				</div>
			</div>

			<!-- Location -->
			{#if selectedDevice.location_name}
				<div class="flex items-center gap-3 text-sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 text-slate-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
						/>
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					<span class="text-slate-300">{selectedDevice.location_name}</span>
				</div>
			{/if}

			<!-- Gateway Connections -->
			<div class="space-y-2">
				<h4 class="text-sm font-medium text-slate-300">Gateway Connections</h4>
				<div class="space-y-2">
					{#each selectedDevice.gateways as gateway (gateway.gateway_id)}
						{@const signalInfo = getSignalStrengthLabel(gateway.rssi)}
						{@const bars = getSignalBars(gateway.rssi)}
						<div class="rounded-lg bg-slate-800/50 p-3">
							<div class="flex items-center justify-between gap-3">
								<div class="flex items-center gap-2 min-w-0">
									<span class="text-lg">📡</span>
									<span class="text-sm text-slate-200 truncate">{gateway.gateway_name || gateway.gateway_id}</span>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<!-- Signal bars -->
									<div class="flex items-end gap-0.5 h-4">
										{#each [1, 2, 3, 4] as barIndex (barIndex)}
											<div
												class="w-1 rounded-sm transition-colors {barIndex <= bars
													? signalInfo.color.replace('text-', 'bg-')
													: 'bg-slate-600'}"
												style="height: {barIndex * 25}%"
											></div>
										{/each}
									</div>
									<span class="text-xs {signalInfo.color}">{signalInfo.label}</span>
								</div>
							</div>
							{#if gateway.rssi !== null || gateway.snr !== null}
								<div class="mt-2 flex items-center gap-4 text-xs text-slate-400">
									{#if gateway.rssi !== null}
										<span>RSSI: <span class="text-slate-300">{gateway.rssi} dBm</span></span>
									{/if}
									{#if gateway.snr !== null}
										<span>SNR: <span class="text-slate-300">{gateway.snr} dB</span></span>
									{/if}
								</div>
							{/if}
						</div>
					{:else}
						<p class="text-sm text-slate-400 italic">No gateway connection data available</p>
					{/each}
				</div>
			</div>

			<!-- Actions -->
			<div class="flex items-center justify-end gap-3 pt-2 border-t border-slate-700">
				<CWButton variant="ghost" onclick={() => (dialogOpen = false)}>
					Close
				</CWButton>
				{#if locationId || selectedDevice.location_id}
					<CWButton onclick={navigateToDevice}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 mr-1.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
						</svg>
						Go to Device
					</CWButton>
				{/if}
			</div>
		</div>
	{/if}
</CWDialog>

<style>
	.network-topology :global(svg) {
		display: block;
	}
</style>
