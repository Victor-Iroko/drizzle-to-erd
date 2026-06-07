import { instance } from "@viz-js/viz";
import type { IRTable } from "../ir.js";
import { emitDot, type DotOptions } from "./dot.js";

export type ImageFormat = "svg" | "png";

let cached: Awaited<ReturnType<typeof instance>> | null = null;

async function getViz() {
	if (!cached) {
		cached = await instance();
	}
	return cached;
}

export type ImageOptions = DotOptions;

export function emitSvg(tables: IRTable[], opts: ImageOptions = {}): Promise<string> {
	return (async () => {
		const dot = emitDot(tables, opts);
		const viz = await getViz();
		return viz.renderString(dot, { format: "svg" });
	})();
}

export async function emitPng(
	tables: IRTable[],
	opts: ImageOptions = {},
): Promise<Uint8Array> {
	const svg = await emitSvg(tables, opts);
	try {
		const mod = await import("@resvg/resvg-js");
		const Resvg = mod.Resvg;
		const resvg = new Resvg(svg, {
			fitTo: { mode: "width", value: 1600 },
			background: "white",
		});
		const rendered = resvg.render();
		const png = rendered.asPng();
		return png instanceof Uint8Array ? png : new Uint8Array(png);
	} catch (err) {
		throw new Error(
			`PNG output requires @resvg/resvg-js. Install it with:\n  bun add @resvg/resvg-js\n\nUnderlying error: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}
