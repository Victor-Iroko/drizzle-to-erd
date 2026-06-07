export type IRColumn = {
	name: string;
	type: string;
	pk: boolean;
	notNull: boolean;
	unique: boolean;
	isArray: boolean;
	default?: string;
	fk?: IRFKRef;
};

export type IRFKRef = {
	table: string;
	schema?: string;
	column: string;
};

export type IRFK = {
	columnsFrom: string[];
	tableTo: string;
	schemaTo?: string;
	columnsTo: string[];
	onDelete?: string;
	onUpdate?: string;
};

export type IRTable = {
	name: string;
	schema?: string;
	columns: IRColumn[];
	foreignKeys: IRFK[];
};
