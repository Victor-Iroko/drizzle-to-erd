import { is, Table } from "drizzle-orm";
import { findConfig, loadConfig } from "./config.js";
import { loadSchema } from "./loadSchema.js";
import { introspectPg } from "./introspect/pg.js";
import { emitMermaid, type EmitOptions } from "./emit/mermaid.js";
import { emitSvg, emitPng } from "./emit/image.js";
import { emitDot } from "./emit/dot.js";
import type { IRTable } from "./ir.js";

export type GenerateOptions = {
	configPath?: string;
	schema?: Record<string, unknown>;
	cwd?: string;
	emit?: EmitOptions;
};

export type Format = "md" | "raw" | "svg" | "png";

async function loadTables(opts: GenerateOptions): Promise<Table[]> {
	if (opts.schema) {
		return Object.values(opts.schema).filter((v): v is Table => is(v, Table));
	}
	const configPath = opts.configPath ?? (await findConfig(opts.cwd));
	const config = await loadConfig(configPath);

	if (config.dialect !== "postgresql") {
		throw new Error(
			`drizzle-to-erd v1 only supports the "postgresql" dialect. Got: "${config.dialect}".`,
		);
	}

	return await loadSchema(config.schema, { cwd: opts.cwd });
}

export type GenerateResult = {
	mermaid?: string;
	dot?: string;
	svg?: string;
	png?: Uint8Array;
};

export async function generate(
	opts?: GenerateOptions,
	format?: "md" | "raw",
): Promise<string>;
export async function generate(opts: GenerateOptions, format: "svg"): Promise<string>;
export async function generate(opts: GenerateOptions, format: "png"): Promise<Uint8Array>;
export async function generate(
	opts: GenerateOptions = {},
	format: Format = "raw",
): Promise<string | Uint8Array> {
	const tables = await loadTables(opts);
	if (tables.length === 0) {
		throw new Error("No tables found in the schema. Check your drizzle.config.ts `schema` paths.");
	}

	const ir: IRTable[] = tables.map((t) => introspectPg(t));

	switch (format) {
		case "md":
		case "raw":
			return emitMermaid(ir, opts.emit);
		case "svg":
			return await emitSvg(ir);
		case "png":
			return await emitPng(ir);
	}
}

export function detectFormat(out: string | undefined, explicit: string | undefined): Format {
	if (explicit) return explicit as Format;
	if (!out) return "raw";
	if (out.endsWith(".svg")) return "svg";
	if (out.endsWith(".png")) return "png";
	return "md";
}

export { emitMermaid, emitSvg, emitPng, emitDot };
export type { EmitOptions } from "./emit/mermaid.js";
export type { ImageOptions, ImageFormat } from "./emit/image.js";
export type { DotOptions } from "./emit/dot.js";
export type { IRTable, IRColumn, IRFK } from "./ir.js";
export { introspectPg } from "./introspect/pg.js";
export { loadSchema, resolveSchemaFiles } from "./loadSchema.js";
export { loadConfig, findConfig } from "./config.js";
