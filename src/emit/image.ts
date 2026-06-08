import { renderMermaidSVG } from "beautiful-mermaid";
import type { IRTable } from "../ir.js";
import { emitMermaid, type EmitOptions } from "./mermaid.js";
import { inlineCssVariables } from "./inline-css.js";

export type ImageFormat = "svg" | "png";

export type ImageOptions = EmitOptions;

export function emitSvg(tables: IRTable[], opts: ImageOptions = {}): string {
	const mermaid = emitMermaid(tables, opts);
	return renderMermaidSVG(mermaid);
}

export async function emitPng(
	tables: IRTable[],
	opts: ImageOptions = {},
): Promise<Uint8Array> {
	const svg = emitSvg(tables, opts);
	const flatSvg = inlineCssVariables(svg);
	try {
		const mod = await import("@resvg/resvg-js");
		const Resvg = mod.Resvg;
		const resvg = new Resvg(flatSvg, {
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
