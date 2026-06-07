import { getTableConfig } from "drizzle-orm/pg-core";
import { Table, is } from "drizzle-orm";
import type { IRColumn, IRFK, IRFKRef, IRTable } from "../ir.js";

type AnyColumn = {
	name: string;
	columnType: string;
	dataType: string;
	notNull: boolean;
	primary: boolean;
	isUnique: boolean;
	hasDefault: boolean;
	default: unknown;
	enumValues?: readonly string[];
	baseColumn?: AnyColumn;
	enum?: { enumName: string; enumValues: readonly string[] };
};

function formatColumnType(col: AnyColumn): string {
	if (col.columnType === "PgArray" && col.baseColumn) {
		return formatColumnType(col.baseColumn) + "[]";
	}
	if (col.columnType === "PgEnumColumn" || col.columnType === "PgEnumObjectColumn") {
		return (col.enum?.enumName ?? "enum").toLowerCase();
	}
	const stripped = col.columnType.replace(/^Pg/, "");
	return stripped.toLowerCase();
}

function formatDefault(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
	if (typeof value === "number" || typeof value === "boolean") return String(value);

	const sqlLike = value as { queryChunks?: Array<{ value?: unknown }> };
	if (sqlLike.queryChunks && Array.isArray(sqlLike.queryChunks)) {
		const parts: string[] = [];
		for (const chunk of sqlLike.queryChunks) {
			if (chunk && Array.isArray((chunk as { value?: unknown }).value)) {
				for (const v of (chunk as { value: unknown[] }).value) {
					if (typeof v === "string") parts.push(v);
				}
			}
		}
		if (parts.length) return parts.join("");
	}

	return undefined;
}

function introspectColumn(col: AnyColumn): IRColumn {
	const result: IRColumn = {
		name: col.name,
		type: formatColumnType(col),
		pk: !!col.primary,
		notNull: !!col.notNull,
		unique: !!col.isUnique,
		isArray: col.columnType === "PgArray",
	};
	const def = formatDefault(col.default);
	if (def !== undefined) result.default = def;
	return result;
}

function introspectFK(fk: ReturnType<typeof getTableConfig>["foreignKeys"][number]): IRFK | null {
	const ref = fk.reference();
	if (!ref || !ref.columns?.length || !ref.foreignColumns?.length) return null;
	const targetConfig = getTableConfig(ref.foreignTable);
	return {
		columnsFrom: ref.columns.map((c: { name: string }) => c.name),
		tableTo: targetConfig.name,
		schemaTo: targetConfig.schema,
		columnsTo: ref.foreignColumns.map((c: { name: string }) => c.name),
		onDelete: fk.onDelete,
		onUpdate: fk.onUpdate,
	};
}

export function introspectPg(table: Table): IRTable {
	const cfg = getTableConfig(table as Parameters<typeof getTableConfig>[0]);
	const columns: IRColumn[] = cfg.columns.map((c) => introspectColumn(c as unknown as AnyColumn));
	const fkByCol: Record<string, IRFKRef> = {};
	const foreignKeys: IRFK[] = [];
	for (const fk of cfg.foreignKeys) {
		const ir = introspectFK(fk);
		if (!ir) continue;
		foreignKeys.push(ir);
		if (ir.columnsFrom.length === 1 && ir.columnsTo.length === 1) {
			fkByCol[ir.columnsFrom[0]!] = {
				table: ir.tableTo,
				schema: ir.schemaTo,
				column: ir.columnsTo[0]!,
			};
		}
	}
	for (const col of columns) {
		const ref = fkByCol[col.name];
		if (ref) col.fk = ref;
	}
	return {
		name: cfg.name,
		schema: cfg.schema,
		columns,
		foreignKeys,
	};
}

export function isPgTable(t: unknown): boolean {
	return is(t, Table);
}
