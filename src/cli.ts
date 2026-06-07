import { resolve } from "node:path";
import { generate, detectFormat, type Format } from "./run.js";

type Args = {
	config?: string;
	out?: string;
	format?: string;
	noAttributes?: boolean;
	help?: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]!;
		switch (a) {
			case "--config":
			case "-c":
				args.config = argv[++i];
				break;
			case "--out":
			case "-o":
				args.out = argv[++i];
				break;
			case "--format":
			case "-f":
				args.format = argv[++i];
				break;
			case "--no-attributes":
				args.noAttributes = true;
				break;
			case "--help":
			case "-h":
				args.help = true;
				break;
		}
	}
	return args;
}

const HELP = `drizzle-to-erd

Generate a Mermaid erDiagram, Graphviz dot, or SVG/PNG image from your Drizzle ORM schema.

Usage:
  bunx drizzle-to-erd [options]

Options:
  -c, --config <path>     Path to drizzle.config.{ts,js,mts,mjs} (default: ./drizzle.config.*)
  -o, --out <path>        Output file (default: stdout)
  -f, --format <fmt>      Output format: md, raw, svg, png (default: inferred from --out extension,
                           or "md" if --out is .md/.markdown, or "raw" if no --out)
      --no-attributes     Skip column attributes (only emit entities + relationships)
  -h, --help              Show this help

Image output (svg, png) requires --out. PNG also requires @resvg/resvg-js to be installed.
`;

async function main() {
	const args = parseArgs(process.argv.slice(2));

	if (args.help) {
		process.stdout.write(HELP);
		return;
	}

	const format = detectFormat(args.out, args.format);

	if ((format === "svg" || format === "png") && !args.out) {
		process.stderr.write(`✗ --format ${format} requires --out <file>\n`);
		process.exit(2);
	}

	const result = await (generate as (opts: unknown, format: Format) => Promise<string | Uint8Array>)(
		{
			configPath: args.config ? resolve(args.config) : undefined,
			emit: { includeAttributes: !args.noAttributes },
		},
		format,
	);

	if (format === "md") {
		const output = `\`\`\`mermaid\n${result as string}\`\`\`\n`;
		if (args.out) {
			const outPath = resolve(args.out);
			await Bun.write(outPath, output);
			process.stderr.write(`✓ Wrote ${outPath}\n`);
		} else {
			process.stdout.write(output);
		}
	} else if (format === "raw" || format === "svg") {
		if (args.out) {
			const outPath = resolve(args.out);
			await Bun.write(outPath, result as string);
			process.stderr.write(`✓ Wrote ${outPath}\n`);
		} else {
			process.stdout.write(result as string);
		}
	} else {
		// png
		const outPath = resolve(args.out!);
		await Bun.write(outPath, result as Uint8Array);
		process.stderr.write(`✓ Wrote ${outPath}\n`);
	}
}

main().catch((err: unknown) => {
	const msg = err instanceof Error ? err.message : String(err);
	process.stderr.write(`✗ ${msg}\n`);
	if (err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`);
	process.exit(1);
});
