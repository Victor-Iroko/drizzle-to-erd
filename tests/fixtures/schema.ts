import {
	pgTable,
	pgEnum,
	serial,
	text,
	varchar,
	integer,
	boolean,
	timestamp,
	uuid,
	jsonb,
	primaryKey,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "member", "guest"]);

export const users = pgTable("users", {
	id: serial("id").primaryKey(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	displayName: text("display_name").notNull(),
	bio: text("bio"),
	role: userRole("role").notNull().default("member"),
	isActive: boolean("is_active").notNull().default(true),
	metadata: jsonb("metadata"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const posts = pgTable("posts", {
	id: uuid("id").primaryKey().defaultRandom(),
	authorId: integer("author_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	published: boolean("published").notNull().default(false),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const comments = pgTable("comments", {
	id: serial("id").primaryKey(),
	postId: uuid("post_id")
		.notNull()
		.references(() => posts.id, { onDelete: "cascade" }),
	authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
	body: text("body").notNull(),
});

export const tags = pgTable("tags", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 50 }).notNull().unique(),
});

export const postsToTags = pgTable(
	"posts_to_tags",
	{
		postId: uuid("post_id")
			.notNull()
			.references(() => posts.id, { onDelete: "cascade" }),
		tagId: serial("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
	},
	(t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

export const organizations = pgTable("organizations", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	ownerId: integer("owner_id")
		.notNull()
		.references(() => users.id),
});
