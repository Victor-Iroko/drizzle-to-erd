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
		? ` <FONT COLOR="#374151"><I>(${tags.join(", ")})</I></FONT>`
		: "";
	return `${htmlEscape(col.name)}${tagStr} : <FONT COLOR="#0f4c81">${htmlEscape(col.type)}</FONT>`;
}

export type DotOptions = {
	direction?: "LR" | "TB";
};

export function emitDot(tables: IRTable[], opts: DotOptions = {}): string {
	const direction = opts.direction ?? "TB";
	const sorted = [...tables].sort((a, b) => a.name.localeCompare(b.name));

	const lines: string[] = [
		"digraph ER {",
		`  graph [rankdir=${direction}, fontname="Helvetica", fontsize=12, pad="0.4", nodesep="0.45", ranksep="0.75", bgcolor="white"];`,
		`  node [shape=record, fontname="Helvetica", fontsize=11, style="rounded,filled", color="#111827", fillcolor="white", fontcolor="#111827", penwidth="1.8"];`,
		`  edge [fontname="Helvetica", fontsize=10, color="#1f2937", fontcolor="#111827", penwidth="1.5", arrowsize="0.85"];`,
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
