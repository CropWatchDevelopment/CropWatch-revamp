<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import * as d3 from 'd3';

	type Gateway = {
		gateway_id: string;
		gateway_name: string;
		is_online: boolean;
		devices: { dev_eui: string; name: string | null }[];
	};

	type GraphNode = {
		id: string;
		label: string;
		type: 'gateway' | 'device';
		isOnline?: boolean;
		x?: number;
		y?: number;
		fx?: number | null;
		fy?: number | null;
	};

	type GraphLink = {
		source: string | GraphNode;
		target: string | GraphNode;
	};

	interface Props {
		gateways: Gateway[];
		height?: number;
	}

	let { gateways, height = 500 }: Props = $props();

	let containerEl: HTMLDivElement | undefined = $state();
	let width = $state(800);

	// Build graph data from gateways
	const graphData = $derived.by(() => {
		const nodes: GraphNode[] = [];
		const links: GraphLink[] = [];
		const seenDevices = new SvelteSet<string>();

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

				// Only add device node once (device can connect to multiple gateways)
				if (!seenDevices.has(device.dev_eui)) {
					seenDevices.add(device.dev_eui);
					nodes.push({
						id: deviceId,
						label: device.name || device.dev_eui,
						type: 'device'
					});
				}

				// Add link from gateway to device
				links.push({
					source: `gw-${gateway.gateway_id}`,
					target: deviceId
				});
			});
		});

		return { nodes, links };
	});

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
		node
			.filter((d) => d.type === 'device')
			.append('circle')
			.attr('r', 28)
			.attr('fill', '#1e293b')
			.attr('stroke', '#0ea5e9')
			.attr('stroke-width', 2);

		// Device icon
		node
			.filter((d) => d.type === 'device')
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('y', -5)
			.attr('fill', '#0ea5e9')
			.attr('font-size', '14px')
			.text('📦');

		// Device label
		node
			.filter((d) => d.type === 'device')
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('y', 12)
			.attr('fill', '#94a3b8')
			.attr('font-size', '9px')
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

<style>
	.network-topology :global(svg) {
		display: block;
	}
</style>
