import type { IRTable } from "../ir.js";

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;

function quoteIdent(name: string): string {
	if (IDENT_RE.test(name)) return name;
	return `"${name.replace(/"/g, '\\"')}"`;
}

function uniqueName(table: IRTable): string {
	if (!table.schema || table.schema === "public") return table.name;
	return `${table.schema}_${table.name}`;
}

function renderColumn(col: IRTable["columns"][number]): string {
	const tags: string[] = [];
	if (col.pk) tags.push("PK");
	if (col.fk) tags.push("FK");
	if (col.unique && !col.pk) tags.push("UK");
	const tagStr = tags.length ? ` ${tags.join(", ")}` : "";
	const comment = col.default ? `default: ${col.default}` : undefined;
	const commentStr = comment ? ` "${comment}"` : "";
	return `        ${col.type} ${col.name}${tagStr}${commentStr}`;
}

function renderEntity(table: IRTable): string {
	const id = quoteIdent(uniqueName(table));
	const lines = [`    ${id} {`];
	for (const col of table.columns) {
		lines.push(renderColumn(col));
	}
	lines.push("    }");
	return lines.join("\n");
}

function isColumnNullable(table: IRTable, colName: string): boolean {
	const col = table.columns.find((c) => c.name === colName);
	return col ? !col.notNull : true;
}

export type EmitOptions = {
	includeAttributes?: boolean;
};

export function emitMermaid(tables: IRTable[], opts: EmitOptions = {}): string {
	const includeAttributes = opts.includeAttributes ?? true;
	const sorted = [...tables].sort((a, b) => a.name.localeCompare(b.name));
	const tableByName = new Map(sorted.map((t) => [t.name, t]));

	const out: string[] = ["erDiagram"];

	if (includeAttributes) {
		for (const t of sorted) {
			out.push(renderEntity(t));
			out.push("");
		}
	}

	for (const t of sorted) {
		for (const fk of t.foreignKeys) {
			const anyNullable = fk.columnsFrom.some((c) => isColumnNullable(t, c));
			const childSide = anyNullable ? "o|" : "||";
			const target = tableByName.get(fk.tableTo);
			const targetIdent = quoteIdent(
				target
					? uniqueName(target)
					: fk.schemaTo
						? `${fk.schemaTo}_${fk.tableTo}`
						: fk.tableTo,
			);
			const sourceIdent = quoteIdent(uniqueName(t));
			const label = fk.columnsFrom.join(", ");
			out.push(`    ${targetIdent} ${childSide}--o{ ${sourceIdent} : "${label}"`);
		}
	}

	return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
