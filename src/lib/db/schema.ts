import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const now = () =>
  integer("ts", { mode: "timestamp" }).default(sql`(unixepoch())`);

export const employees = sqliteTable(
  "employees",
  {
    id: id(),
    personId: text("person_id").notNull().unique(),
    name: text("name").notNull(),
    department: text("department"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    notes: text("notes"),
  },
  (t) => ({
    deptIdx: index("emp_dept_idx").on(t.department),
    activeIdx: index("emp_active_idx").on(t.active),
  })
);

export const importBatches = sqliteTable("import_batches", {
  id: id(),
  filename: text("filename").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  totalRows: integer("total_rows").notNull(),
  employeesCount: integer("employees_count").notNull(),
  daysCount: integer("days_count").notNull(),
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  rawSnapshot: text("raw_snapshot"),
});

export const justificationTypes = sqliteTable("justification_types", {
  id: id(),
  code: text("code").notNull().unique(),
  labelEs: text("label_es").notNull(),
  countsAsWorked: integer("counts_as_worked", { mode: "boolean" }).notNull().default(true),
  color: text("color"),
  icon: text("icon"),
  orderIndex: integer("order_index").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const attendanceDays = sqliteTable(
  "attendance_days",
  {
    id: id(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id),
    workDate: text("work_date").notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    isWorkday: integer("is_workday", { mode: "boolean" }).notNull(),

    rawPunches: text("raw_punches", { mode: "json" }).$type<string[]>().notNull(),
    correctedPunches: text("corrected_punches", { mode: "json" }).$type<string[] | null>(),

    justificationId: text("justification_id").references(() => justificationTypes.id),
    justificationNote: text("justification_note"),

    effectivePunches: text("effective_punches", { mode: "json" }).$type<string[]>().notNull(),
    status: text("status").notNull(),
    checkIn: text("check_in"),
    checkOut: text("check_out"),
    workedMinutes: integer("worked_minutes"),
    lateMinutes: integer("late_minutes").notNull().default(0),
    earlyLeaveMinutes: integer("early_leave_minutes").notNull().default(0),
    incidents: text("incidents", { mode: "json" }).$type<string[]>().notNull().default(sql`('[]')`),

    modifiedAt: now(),
  },
  (t) => ({
    uniq: uniqueIndex("att_emp_date_uniq").on(t.employeeId, t.workDate),
    dateIdx: index("att_date_idx").on(t.workDate),
    statusIdx: index("att_status_idx").on(t.status),
  })
);

export const holidays = sqliteTable("holidays", {
  id: id(),
  holidayDate: text("holiday_date").notNull().unique(),
  description: text("description").notNull(),
  isNational: integer("is_national", { mode: "boolean" }).notNull().default(true),
});

export const appSettings = sqliteTable("app_settings", {
  id: text("id").primaryKey().$defaultFn(() => "default"),
  weekdayStart: text("weekday_start").notNull().default("08:30"),
  weekdayEnd: text("weekday_end").notNull().default("18:30"),
  weekdayHours: real("weekday_hours").notNull().default(9),
  saturdayStart: text("saturday_start").notNull().default("08:30"),
  saturdayEnd: text("saturday_end").notNull().default("14:00"),
  saturdayHours: real("saturday_hours").notNull().default(5.5),
  toleranceMinutes: integer("tolerance_minutes").notNull().default(5),
  duplicateThresholdMinutes: integer("duplicate_threshold_minutes").notNull().default(2),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

/* =========================== Auth.js tables =========================== */
export const ROLES = ["admin", "rrhh", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("email_verified", { mode: "timestamp_ms" }),
  image: text("image"),
  role: text("role").$type<Role>().notNull().default("viewer"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({ pk: uniqueIndex("acct_pk").on(t.provider, t.providerAccountId) })
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({ pk: uniqueIndex("vt_pk").on(t.identifier, t.token) })
);

export type User = typeof users.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type AttendanceDay = typeof attendanceDays.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
export type JustificationType = typeof justificationTypes.$inferSelect;
