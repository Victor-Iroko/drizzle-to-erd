export {
	generate,
	detectFormat,
	emitMermaid,
	emitSvg,
	emitPng,
	emitDot,
	type GenerateOptions,
	type Format,
	type GenerateResult,
} from "./src/run.js";
export type { EmitOptions } from "./src/emit/mermaid.js";
export type { ImageOptions, ImageFormat } from "./src/emit/image.js";
export type { DotOptions } from "./src/emit/dot.js";
export type { IRTable, IRColumn, IRFK, IRFKRef } from "./src/ir.js";
export { introspectPg } from "./src/introspect/pg.js";
export { loadSchema, resolveSchemaFiles } from "./src/loadSchema.js";
export { loadConfig, findConfig } from "./src/config.js";
