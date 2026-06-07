import { Glob } from "bun";
import { is, Table } from "drizzle-orm";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export type LoadOptions = {
	cwd?: string;
};

export async function resolveSchemaFiles(
	patterns: string | string[],
	opts: LoadOptions = {},
): Promise<string[]> {
	const cwd = opts.cwd ?? process.cwd();
	const list = Array.isArray(patterns) ? patterns : [patterns];
	const seen = new Set<string>();

	for (const pattern of list) {
		let scanCwd = cwd;
		let globPattern = pattern;
		if (isAbsolute(pattern)) {
			scanCwd = dirname(pattern);
			globPattern = pattern
				.slice(scanCwd.length)
				.replace(/^[\\/]+/, "")
				.replace(/\\/g, "/");
			if (!globPattern) globPattern = ".";
		} else {
			globPattern = pattern.replace(/\\/g, "/");
		}
		const glob = new Glob(globPattern);
		for await (const file of glob.scan({ cwd: scanCwd, absolute: true })) {
			if (file.endsWith(".d.ts") || file.endsWith(".d.mts") || file.endsWith(".d.cts")) continue;
			if (file.includes(`${resolve(cwd, "node_modules")}`)) continue;
			if (file.includes(`${resolve(cwd, "dist")}`)) continue;
			const rel = relative(cwd, file);
			seen.add(rel.split(/[\\/]/).join("/"));
		}
	}

	const abs = [...seen].map((rel) => resolve(cwd, rel));
	return abs.sort();
}

export async function loadSchema(
	patterns: string | string[],
	opts: LoadOptions = {},
): Promise<Table[]> {
	const files = await resolveSchemaFiles(patterns, opts);
	const tables: Table[] = [];
	for (const file of files) {
		const mod = await import(file);
		for (const value of Object.values(mod)) {
			if (is(value, Table)) {
				tables.push(value as Table);
			}
		}
	}
	return tables;
}
