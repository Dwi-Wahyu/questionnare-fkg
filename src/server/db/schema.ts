import {
	boolean,
	index,
	int,
	json,
	mediumtext,
	mysqlEnum,
	mysqlTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/mysql-core";

// ─────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
	id: int("id").autoincrement().primaryKey(),
	username: varchar("username", { length: 100 }).notNull().unique(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	role: mysqlEnum("role", ["admin", "visitor"]).notNull().default("visitor"),
	name: varchar("name", { length: 150 }).notNull(),
	email: varchar("email", { length: 150 }),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// SURVEYS
// ─────────────────────────────────────────────────────────────
export const surveys = mysqlTable("surveys", {
	id: int("id").autoincrement().primaryKey(),
	slug: varchar("slug", { length: 150 }).notNull().unique(),
	title: varchar("title", { length: 255 }).notNull(),
	description: text("description"),
	bannerUrl: mediumtext("banner_url"),
	// Category used to group the admin nav dropdown (PRD §6.5).
	category: varchar("category", { length: 100 }).notNull(),
	periodType: mysqlEnum("period_type", ["month", "date"])
		.notNull()
		.default("month"),
	periodValue: varchar("period_value", { length: 10 }),
	periodValueEnd: varchar("period_value_end", { length: 10 }),
	status: mysqlEnum("status", ["draft", "published", "archived"])
		.notNull()
		.default("draft"),
	createdBy: int("created_by")
		.references(() => users.id)
		.notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ─────────────────────────────────────────────────────────────
// SECTIONS  ("Bagian 1 dari N")
// ─────────────────────────────────────────────────────────────
export const sections = mysqlTable(
	"sections",
	{
		id: int("id").autoincrement().primaryKey(),
		surveyId: int("survey_id")
			.references(() => surveys.id, { onDelete: "cascade" })
			.notNull(),
		title: varchar("title", { length: 255 }).notNull(),
		description: text("description"),
		order: int("order").notNull().default(0),
	},
	(table) => ({
		surveyIdx: index("sections_survey_idx").on(table.surveyId),
	}),
);

// ─────────────────────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────────────────────
export const questions = mysqlTable(
	"questions",
	{
		id: int("id").autoincrement().primaryKey(),
		surveyId: int("survey_id")
			.references(() => surveys.id, { onDelete: "cascade" })
			.notNull(), // denormalized, see §1
		sectionId: int("section_id")
			.references(() => sections.id, { onDelete: "cascade" })
			.notNull(),
		type: mysqlEnum("type", [
			"short_text",
			"paragraph",
			"multiple_choice",
			"checkboxes",
			"dropdown",
			"linear_scale",
			"grid",
			"date",
		]).notNull(),
		title: varchar("title", { length: 500 }).notNull(),
		description: text("description"),
		required: boolean("required").notNull().default(false),
		order: int("order").notNull().default(0),
		allowOther: boolean("allow_other").notNull().default(false),
		// Type-specific config that doesn't need its own table:
		// short_text/paragraph -> { maxLength?, pattern? }
		// checkboxes           -> { minSelected?, maxSelected? }
		// linear_scale         -> { min, max, minLabel?, maxLabel? }
		// grid                 -> { rowsRequired?: boolean }
		// date                 -> { minDate?, maxDate? }
		config: json("config").$type<Record<string, unknown>>(),
	},
	(table) => ({
		surveyIdx: index("questions_survey_idx").on(table.surveyId),
		sectionIdx: index("questions_section_idx").on(table.sectionId),
	}),
);

// ─────────────────────────────────────────────────────────────
// QUESTION OPTIONS (choices, scale points, and grid rows/columns)
// ─────────────────────────────────────────────────────────────
export const questionOptions = mysqlTable(
	"question_options",
	{
		id: int("id").autoincrement().primaryKey(),
		questionId: int("question_id")
			.references(() => questions.id, { onDelete: "cascade" })
			.notNull(),
		// "choice" for multiple_choice/checkboxes/dropdown/linear_scale points,
		// "row" / "column" for grid questions only.
		group: mysqlEnum("group", ["choice", "row", "column"])
			.notNull()
			.default("choice"),
		label: varchar("label", { length: 500 }).notNull(),
		value: varchar("value", { length: 255 }), // optional machine value distinct from display label
		order: int("order").notNull().default(0),
	},
	(table) => ({
		questionIdx: index("question_options_question_idx").on(table.questionId),
	}),
);

// ─────────────────────────────────────────────────────────────
// RESPONSES  (one per respondent submission attempt)
// ─────────────────────────────────────────────────────────────
export const responses = mysqlTable(
	"responses",
	{
		id: int("id").autoincrement().primaryKey(),
		surveyId: int("survey_id")
			.references(() => surveys.id, { onDelete: "cascade" })
			.notNull(),
		status: mysqlEnum("status", ["started", "completed"])
			.notNull()
			.default("started"),
		startedAt: timestamp("started_at").notNull().defaultNow(),
		submittedAt: timestamp("submitted_at"),
		// Best-effort respondent fingerprint for the "restore my draft" flow —
		// not used for identity/security, just draft correlation.
		clientDraftId: varchar("client_draft_id", { length: 100 }),
	},
	(table) => ({
		surveyIdx: index("responses_survey_idx").on(table.surveyId),
	}),
);

// ─────────────────────────────────────────────────────────────
// ANSWERS
// ─────────────────────────────────────────────────────────────
export const answers = mysqlTable(
	"answers",
	{
		id: int("id").autoincrement().primaryKey(),
		responseId: int("response_id")
			.references(() => responses.id, { onDelete: "cascade" })
			.notNull(),
		questionId: int("question_id")
			.references(() => questions.id, { onDelete: "cascade" })
			.notNull(),
		valueText: text("value_text"),
		valueOptionIds: json("value_option_ids").$type<number[]>(),
		valueGrid: json("value_grid").$type<Record<string, number>>(),
	},
	(table) => ({
		responseIdx: index("answers_response_idx").on(table.responseId),
		questionIdx: index("answers_question_idx").on(table.questionId),
	}),
);

// ─────────────────────────────────────────────────────────────
// REPORT GENERATIONS (for rate limiting, see §C.1)
// ─────────────────────────────────────────────────────────────
export const reportGenerations = mysqlTable("report_generations", {
	id: int("id").autoincrement().primaryKey(),
	surveyId: int("survey_id")
		.references(() => surveys.id, { onDelete: "cascade" })
		.notNull(),
	userId: int("user_id")
		.references(() => users.id, { onDelete: "cascade" })
		.notNull(),
	generatedAt: timestamp("generated_at").notNull().defaultNow(),
	fileBase64: mediumtext("file_base_64"),
	fileName: varchar("file_name", { length: 255 }),
});
