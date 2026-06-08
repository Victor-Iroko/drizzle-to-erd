import { renderMermaidSVG } from "beautiful-mermaid";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { IRTable } from "../ir.js";
import { emitMermaid, type EmitOptions } from "./mermaid.js";
import { inlineCssVariables } from "./inline-css.js";

export type ImageFormat = "svg" | "png";

export type ImageOptions = EmitOptions;

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = join(__dirname, "../../fonts");

const FONT_FILES = [
	join(FONT_DIR, "Inter-Regular.ttf"),
	join(FONT_DIR, "Inter-Medium.ttf"),
	join(FONT_DIR, "Inter-SemiBold.ttf"),
	join(FONT_DIR, "Inter-Bold.ttf"),
	join(FONT_DIR, "JetBrainsMono-Regular.ttf"),
	join(FONT_DIR, "JetBrainsMono-Medium.ttf"),
];

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
			fitTo: { mode: "zoom", value: 3 },
			background: "white",
			font: {
				fontFiles: FONT_FILES,
				loadSystemFonts: false,
				defaultFontFamily: "sans-serif",
				monospaceFamily: "monospace",
			},
		});
		const rendered = resvg.render();
		console.log(`Actual output: ${rendered.width} × ${rendered.height}`);
		const png = rendered.asPng();
		return png instanceof Uint8Array ? png : new Uint8Array(png);
	} catch (err) {
		throw new Error(
			`PNG output requires @resvg/resvg-js. Install it with:\n  bun add @resvg/resvg-js\n\nUnderlying error: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}
