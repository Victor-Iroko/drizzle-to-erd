import { resolve } from "node:path";

export type LoadedConfig = {
	dialect: string;
	schema: string | string[];
	tablesFilter?: string | string[];
	schemaFilter?: string | string[];
};

const DEFAULT_CONFIG_PATHS = [
	"drizzle.config.ts",
	"drizzle.config.js",
	"drizzle.config.mts",
	"drizzle.config.mjs",
	"drizzle.config.cts",
	"drizzle.config.cjs",
];

export async function findConfig(cwd: string = process.cwd()): Promise<string> {
	for (const candidate of DEFAULT_CONFIG_PATHS) {
		const abs = resolve(cwd, candidate);
		const file = Bun.file(abs);
		if (await file.exists()) return abs;
	}
	throw new Error(
		`Could not find drizzle.config.{ts,js,mts,mjs,cts,cjs} in ${cwd}. Pass --config to specify a path.`,
	);
}

export async function loadConfig(configPath: string): Promise<LoadedConfig> {
	const abs = resolve(configPath);
	const mod = await import(abs);
	const raw = mod.default ?? mod.config ?? mod;
	const config = (raw && typeof raw === "object" && "config" in raw ? raw.config : raw) as LoadedConfig;

	if (!config || typeof config !== "object") {
		throw new Error(`drizzle config at ${abs} did not export an object`);
	}
	if (!config.dialect) {
		throw new Error(`drizzle config at ${abs} is missing required "dialect" field`);
	}
	if (!config.schema) {
		throw new Error(`drizzle config at ${abs} is missing required "schema" field`);
	}

	return config;
}
