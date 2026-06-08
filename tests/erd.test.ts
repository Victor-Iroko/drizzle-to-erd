import { describe, expect, it, beforeAll } from "bun:test";
import { generate, emitDot, emitSvg, emitPng, detectFormat } from "../index.js";
import { resolve } from "node:path";

describe("generate()", () => {
	const fixtureConfig = resolve(import.meta.dir, "fixtures/drizzle.config.ts");

	it("produces a Mermaid erDiagram from a fixture schema", async () => {
		const mermaid = await generate({ configPath: fixtureConfig });
		expect(mermaid).toStartWith("erDiagram");
		expect(mermaid).toContain("users");
		expect(mermaid).toContain("posts");
		expect(mermaid).toContain("comments");
		expect(mermaid).toContain("tags");
		expect(mermaid).toContain("posts_to_tags");
		expect(mermaid).toContain("organizations");
	});

	it("marks primary keys with PK", async () => {
		const mermaid = await generate({ configPath: fixtureConfig });
		expect(mermaid).toMatch(/users \{\s+serial id PK/m);
	});

	it("marks unique columns with UK", async () => {
		const mermaid = await generate({ configPath: fixtureConfig });
		expect(mermaid).toMatch(/varchar email UK/);
		expect(mermaid).toMatch(/varchar name UK/);
	});

	it("marks foreign key columns with FK", async () => {
		const mermaid = await generate({ configPath: fixtureConfig });
		expect(mermaid).toMatch(/integer author_id FK/);
		expect(mermaid).toMatch(/uuid post_id FK/);
	});

	it("renders nullable FK with o| cardinality", async () => {
		const mermaid = await generate({ configPath: fixtureConfig });
		expect(mermaid).toMatch(/users o\|--o\{ comments/);
	});

	it("renders non-null FK with || cardinality", async () => {
		const mermaid = await generate({ configPath: fixtureConfig });
		expect(mermaid).toMatch(/users \|\|--o\{ posts/);
		expect(mermaid).toMatch(/posts \|\|--o\{ comments/);
	});

	it("renders enum types", async () => {
		const mermaid = await generate({ configPath: fixtureConfig });
		expect(mermaid).toMatch(/user_role role/);
	});

	it("renders default values in column comments", async () => {
		const mermaid = await generate({ configPath: fixtureConfig });
		expect(mermaid).toMatch(/default: 'member'/);
		expect(mermaid).toMatch(/default: true/);
	});

	it("emits FK label as the source column name", async () => {
		const mermaid = await generate({ configPath: fixtureConfig });
		expect(mermaid).toMatch(/: "author_id"/);
	});

	it("respects --no-attributes via emit option", async () => {
		const mermaid = await generate({
			configPath: fixtureConfig,
			emit: { includeAttributes: false },
		});
		expect(mermaid).not.toContain("PK");
		expect(mermaid).not.toContain("FK");
	});

	it("works with a schema object passed directly (no config file)", async () => {
		const schema = await import("./fixtures/schema.js");
		const mermaid = await generate({ schema });
		expect(mermaid).toStartWith("erDiagram");
		expect(mermaid).toContain("users");
	});

	it("sorts tables alphabetically", async () => {
		const mermaid = await generate({ configPath: fixtureConfig });
		const positions = ["comments", "organizations", "posts", "posts_to_tags", "tags", "users"].map(
			(name) => ({ name, pos: mermaid.indexOf(`${name} {`) }),
		);
		for (let i = 1; i < positions.length; i++) {
			expect(positions[i]!.pos).toBeGreaterThan(positions[i - 1]!.pos);
		}
	});

	it("matches the golden snapshot exactly", async () => {
		const mermaid = await generate({ configPath: fixtureConfig });
		const expected = await Bun.file(resolve(import.meta.dir, "fixtures/expected.mermaid")).text();
		expect(mermaid).toBe(expected);
	});
});

describe("CLI", () => {
	const cliPath = resolve(import.meta.dir, "../src/cli.ts");
	const fixtureConfig = resolve(import.meta.dir, "fixtures/drizzle.config.ts");

	it("prints Mermaid to stdout without --out", async () => {
		const proc = Bun.spawn(["bun", "run", cliPath, "--config", fixtureConfig], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);
		expect(exitCode).toBe(0);
		expect(stderr).toBe("");
		expect(stdout).toStartWith("erDiagram");
		expect(stdout).toContain("users");
	});

	it("writes a markdown-fenced file with --out", async () => {
		const tmp = resolve(import.meta.dir, ".tmp-erd.md");
		const proc = Bun.spawn(
			["bun", "run", cliPath, "--config", fixtureConfig, "--out", tmp],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const exitCode = await proc.exited;
		expect(exitCode).toBe(0);
		const contents = await Bun.file(tmp).text();
		expect(contents).toStartWith("```mermaid\n");
		expect(contents).toContain("erDiagram");
		await Bun.write(tmp, "");
	});

	it("errors clearly on non-postgres dialect", async () => {
		const badConfig = resolve(import.meta.dir, "fixtures/bad-dialect.config.ts");
		await Bun.write(
			badConfig,
			`import { defineConfig } from "drizzle-kit";\nexport default defineConfig({ dialect: "sqlite", schema: "./schema.ts" });\n`,
		);
		const proc = Bun.spawn(["bun", "run", cliPath, "--config", badConfig], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const [stderr, exitCode] = await Promise.all([
			new Response(proc.stderr).text(),
			proc.exited,
		]);
		expect(exitCode).toBe(1);
		expect(stderr).toMatch(/postgresql/i);
		await Bun.write(badConfig, "");
	});
});

describe("format detection", () => {
	it("returns 'raw' when no --out and no --format", () => {
		expect(detectFormat(undefined, undefined)).toBe("raw");
	});
	it("returns 'md' for .md extension", () => {
		expect(detectFormat("foo.md", undefined)).toBe("md");
	});
	it("returns 'svg' for .svg extension", () => {
		expect(detectFormat("foo.svg", undefined)).toBe("svg");
	});
	it("returns 'png' for .png extension", () => {
		expect(detectFormat("foo.png", undefined)).toBe("png");
	});
	it("respects explicit --format over extension", () => {
		expect(detectFormat("foo.svg", "raw")).toBe("raw");
	});
});

describe("emitDot()", () => {
	async function loadIR() {
		const { introspectPg } = await import("../index.js");
		const { is, Table } = await import("drizzle-orm");
		const schema = (await import("./fixtures/schema.js")) as Record<string, unknown>;
		const ts = Object.values(schema).filter((v) => is(v as never, Table));
		return ts.map((t) => introspectPg(t as never));
	}

	it("produces a digraph with each table as a record", async () => {
		const ir = await loadIR();
		const dotStr = emitDot(ir);
		expect(dotStr).toStartWith("digraph ER {");
		expect(dotStr).toContain("rankdir=TB");
		expect(dotStr).toContain('bgcolor="white"');
		expect(dotStr).toContain("shape=record");
		expect(dotStr).toContain('color="#111827"');
		expect(dotStr).toContain("users");
		expect(dotStr).toContain("posts");
		expect(dotStr).toContain("comments");
		expect(dotStr).toContain("->");
	});

	it("renders cardinality markers on edges", async () => {
		const ir = await loadIR();
		const dot = emitDot(ir);
		// nullable FK (comments.author_id) → odot at the "one" end
		expect(dot).toMatch(/users -> comments.*odot/);
		// non-null FK (posts.author_id) → tee at the "one" end
		expect(dot).toMatch(/users -> posts.*tee/);
		// crow's foot at the "many" end
		expect(dot).toContain("arrowhead=crow");
	});

	it("quotes edge labels as strings (not identifiers)", async () => {
		const ir = await loadIR();
		const dot = emitDot(ir);
		// author_id has no spaces but the label should still be a quoted string
		expect(dot).toMatch(/label="author_id"/);
	});
});

describe("emitSvg()", () => {
	const fixtureConfig = resolve(import.meta.dir, "fixtures/drizzle.config.ts");

	async function loadIR() {
		const { introspectPg } = await import("../index.js");
		const { is, Table } = await import("drizzle-orm");
		const schema = (await import("./fixtures/schema.js")) as Record<string, unknown>;
		const ts = Object.values(schema).filter((v) => is(v as never, Table));
		return ts.map((t) => introspectPg(t as never));
	}

	it("produces a valid SVG string", async () => {
		const ir = await loadIR();
		const svg = await emitSvg(ir);
		expect(svg).toStartWith("<?xml");
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
		expect(svg).toContain("users");
		expect(svg).toContain("posts");
	});

	it("SVG contains a record node per table", async () => {
		const ir = await loadIR();
		const svg = await emitSvg(ir);
		expect(svg.match(/<title>/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
	});
});

describe("emitPng()", () => {
	it("produces a Uint8Array starting with the PNG magic bytes", async () => {
		const { introspectPg } = await import("../index.js");
		const { is, Table } = await import("drizzle-orm");
		const schema = (await import("./fixtures/schema.js")) as Record<string, unknown>;
		const ts = Object.values(schema).filter((v) => is(v as never, Table));
		const ir = ts.map((t) => introspectPg(t as never));
		const png = await emitPng(ir);
		expect(png).toBeInstanceOf(Uint8Array);
		// PNG magic: 89 50 4E 47 0D 0A 1A 0A
		expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	});
});

describe("CLI image output", () => {
	const cliPath = resolve(import.meta.dir, "../src/cli.ts");
	const fixtureConfig = resolve(import.meta.dir, "fixtures/drizzle.config.ts");

	it("writes SVG when --out ends in .svg", async () => {
		const tmp = resolve(import.meta.dir, ".tmp-erd.svg");
		const proc = Bun.spawn(
			["bun", "run", cliPath, "--config", fixtureConfig, "--out", tmp],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const exitCode = await proc.exited;
		expect(exitCode).toBe(0);
		const contents = await Bun.file(tmp).text();
		expect(contents).toStartWith("<?xml");
		expect(contents).toContain("<svg");
		await Bun.write(tmp, "");
	});

	it("writes PNG when --out ends in .png", async () => {
		const tmp = resolve(import.meta.dir, ".tmp-erd.png");
		const proc = Bun.spawn(
			["bun", "run", cliPath, "--config", fixtureConfig, "--out", tmp],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const exitCode = await proc.exited;
		expect(exitCode).toBe(0);
		const buf = await Bun.file(tmp).arrayBuffer();
		const bytes = new Uint8Array(buf);
		expect(bytes.length).toBeGreaterThan(8);
		expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		await Bun.write(tmp, new Uint8Array());
	});

	it("errors when --format svg is passed without --out", async () => {
		const proc = Bun.spawn(["bun", "run", cliPath, "--config", fixtureConfig, "--format", "svg"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const [stderr, exitCode] = await Promise.all([
			new Response(proc.stderr).text(),
			proc.exited,
		]);
		expect(exitCode).toBe(2);
		expect(stderr).toMatch(/requires --out/);
	});
});
