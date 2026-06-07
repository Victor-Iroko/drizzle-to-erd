import type { IRTable } from "../ir.js";

function htmlEscape(s: string): string {
	return s.replace(/[&<>"']/g, (c) => {
		switch (c) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			case "'":
				return "&#39;";
		}
		return c;
	});
}

function dotIdent(name: string): string {
	if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return name;
	return `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function dotString(s: string): string {
	return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function formatColumnLabel(col: IRTable["columns"][number]): string {
	const tags: string[] = [];
	if (col.pk) tags.push("PK");
	if (col.fk) tags.push("FK");
	if (col.unique && !col.pk) tags.push("UK");
	const tagStr = tags.length
		? ` <FONT COLOR="#888888"><I>(${tags.join(", ")})</I></FONT>`
		: "";
	return `${htmlEscape(col.name)}${tagStr} : <FONT COLOR="#3b6fa0">${htmlEscape(col.type)}</FONT>`;
}

export type DotOptions = {
	direction?: "LR" | "TB";
};

export function emitDot(tables: IRTable[], opts: DotOptions = {}): string {
	const direction = opts.direction ?? "LR";
	const sorted = [...tables].sort((a, b) => a.name.localeCompare(b.name));

	const lines: string[] = [
		"digraph ER {",
		`  graph [rankdir=${direction}, fontname="Helvetica", fontsize=11, pad="0.5", nodesep="0.6", ranksep="1.2", bgcolor="transparent"];`,
		`  node [shape=record, fontname="Helvetica", fontsize=10, style="rounded", color="#888888", penwidth="1.2"];`,
		`  edge [fontname="Helvetica", fontsize=9, color="#666666", penwidth="1.0"];`,
		"",
	];

	for (const t of sorted) {
		const fields = [
			`<B>${htmlEscape(t.name)}</B>`,
			...t.columns.map(formatColumnLabel),
		];
		const label = `{${fields.join(" | ")}}`;
		lines.push(`  ${dotIdent(t.name)} [label=<${label}>];`);
	}

	lines.push("");

	for (const t of sorted) {
		for (const fk of t.foreignKeys) {
			const anyNullable = fk.columnsFrom.some(
				(c) => !(t.columns.find((cc) => cc.name === c)?.notNull ?? true),
			);
			const label = fk.columnsFrom.join(", ");
			const oneSymbol = anyNullable ? "odot" : "tee";
			lines.push(
				`  ${dotIdent(fk.tableTo)} -> ${dotIdent(t.name)} [label=${dotString(label)}, arrowtail=${oneSymbol}, arrowhead=crow, dir=both];`,
			);
		}
	}

	lines.push("}");
	return lines.join("\n") + "\n";
}
