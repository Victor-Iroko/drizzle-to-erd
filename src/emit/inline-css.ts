function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const h = hex.replace("#", "");
	return {
		r: parseInt(h.substring(0, 2), 16),
		g: parseInt(h.substring(2, 4), 16),
		b: parseInt(h.substring(4, 6), 16),
	};
}

function rgbToHex(r: number, g: number, b: number): string {
	const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n)))
		.toString(16)
		.padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function colorMix(color1: string, percent: number, color2: string): string {
	const c1 = hexToRgb(color1);
	const c2 = hexToRgb(color2);
	const p = percent / 100;
	return rgbToHex(
		c1.r * p + c2.r * (1 - p),
		c1.g * p + c2.g * (1 - p),
		c1.b * p + c2.b * (1 - p),
	);
}

function parseColorMix(str: string, bg: string, fg: string): string | null {
	const match = str.match(
		/color-mix\(\s*in\s+srgb\s*,\s*var\(--fg\)\s+(\d+(?:\.\d+)?)%\s*,\s*var\(--bg\)\s*\)/,
	);
	if (match) {
		return colorMix(fg, parseFloat(match[1]!), bg);
	}
	return null;
}

function resolveColor(value: string, vars: Record<string, string>): string {
	const varMatch = value.match(/^var\(--(\w+(?:-\w+)*)\)$/);
	if (varMatch) {
		return vars[varMatch[1]!] ?? value;
	}

	const fallbackMatch = value.match(
		/^var\(--(\w+(?:-\w+)*),\s*(.+)\)$/,
	);
	if (fallbackMatch) {
		const varName = fallbackMatch[1]!;
		const fallback = fallbackMatch[2]!;
		return vars[varName] ?? resolveColor(fallback, vars);
	}

	return value;
}

export type InlineOptions = {
	bg?: string;
	fg?: string;
	line?: string;
	accent?: string;
	muted?: string;
	surface?: string;
	border?: string;
};

export function inlineCssVariables(svg: string, opts: InlineOptions = {}): string {
	const bg = opts.bg ?? "#FFFFFF";
	const fg = opts.fg ?? "#27272A";

	const vars: Record<string, string> = {
		bg,
		fg,
	};

	vars["line"] = opts.line ?? colorMix(fg, 50, bg);
	vars["accent"] = opts.accent ?? colorMix(fg, 85, bg);
	vars["muted"] = opts.muted ?? colorMix(fg, 60, bg);
	vars["surface"] = opts.surface ?? colorMix(fg, 3, bg);
	vars["border"] = opts.border ?? colorMix(fg, 20, bg);

	vars["_text"] = fg;
	vars["_text-sec"] = vars["muted"];
	vars["_text-muted"] = colorMix(fg, 40, bg);
	vars["_text-faint"] = colorMix(fg, 25, bg);
	vars["_line"] = vars["line"];
	vars["_arrow"] = vars["accent"];
	vars["_node-fill"] = vars["surface"];
	vars["_node-stroke"] = vars["border"];
	vars["_group-fill"] = bg;
	vars["_group-hdr"] = colorMix(fg, 5, bg);
	vars["_inner-stroke"] = colorMix(fg, 12, bg);
	vars["_key-badge"] = colorMix(fg, 10, bg);

	let result = svg;

	result = result.replace(
		/<svg([^>]*)style="[^"]*"/,
		`<svg$1style="background:${bg}"`,
	);

	const styleMatch = result.match(/<style>([\s\S]*?)<\/style>/);
	if (styleMatch) {
		const styleContent = styleMatch[1];
		const fontRules: string[] = [];
		let currentSelector = "";
		for (const line of styleContent.split("\n")) {
			const trimmed = line.trim();
			if (trimmed.startsWith("@import") || trimmed.startsWith("svg")) continue;
			if (/^[a-zA-Z.][^{]*\{/.test(trimmed)) {
				currentSelector = trimmed.replace(/\{.*/, "").trim();
			}
			if (trimmed.includes("font-family")) {
				const decl = trimmed.replace(/;$/, "").trim();
				fontRules.push(`${currentSelector} { ${decl} }`);
			}
		}
		if (fontRules.length > 0) {
			result = result.replace(
				/<style>[\s\S]*?<\/style>/,
				`<style>\n${fontRules.join("\n")}\n</style>`,
			);
		} else {
			result = result.replace(/<style>[\s\S]*?<\/style>\s*/, "");
		}
	}

	result = result.replace(
		/(fill|stroke|background)\s*=\s*"var\(--([^)]+)\)"/g,
		(_, attr: string, varRef: string) => {
			const resolved = resolveColor(`var(--${varRef})`, vars);
			return `${attr}="${resolved}"`;
		},
	);

	result = result.replace(
		/fill\s*=\s*"\{(.*?)\}"/g,
		(_, expr: string) => `fill="${expr}"`,
	);

	return result;
}
