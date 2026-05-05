import { sql } from "drizzle-orm";
import {
  pgTable, text, integer, real, boolean, timestamp, jsonb, uuid,
  uniqueIndex, index,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const now = () => timestamp("ts", { withTimezone: true }).defaultNow();

export const employees = pgTable(
  "employees",
  {
    id: id(),
    personId: text("person_id").notNull().unique(),
    name: text("name").notNull(),
    department: text("department"),
    active: boolean("active").notNull().default(true),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow(),
    notes: text("notes"),
  },
  (t) => ({
    deptIdx: index("emp_dept_idx").on(t.department),
    activeIdx: index("emp_active_idx").on(t.active),
  })
);

export const importBatches = pgTable("import_batches", {
  id: id(),
  filename: text("filename").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  totalRows: integer("total_rows").notNull(),
  employeesCount: integer("employees_count").notNull(),
  daysCount: integer("days_count").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow(),
  rawSnapshot: jsonb("raw_snapshot"),
});

export const justificationTypes = pgTable("justification_types", {
  id: id(),
  code: text("code").notNull().unique(),
  labelEs: text("label_es").notNull(),
  countsAsWorked: boolean("counts_as_worked").notNull().default(true),
  color: text("color"),
  icon: text("icon"),
  orderIndex: integer("order_index").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const attendanceDays = pgTable(
  "attendance_days",
  {
    id: id(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    workDate: text("work_date").notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    isWorkday: boolean("is_workday").notNull(),

    rawPunches: jsonb("raw_punches").$type<string[]>().notNull(),
    correctedPunches: jsonb("corrected_punches").$type<string[] | null>(),

    justificationId: uuid("justification_id").references(() => justificationTypes.id),
    justificationNote: text("justification_note"),

    effectivePunches: jsonb("effective_punches").$type<string[]>().notNull(),
    status: text("status").notNull(),
    checkIn: text("check_in"),
    checkOut: text("check_out"),
    workedMinutes: integer("worked_minutes"),
    lateMinutes: integer("late_minutes").notNull().default(0),
    earlyLeaveMinutes: integer("early_leave_minutes").notNull().default(0),
    incidents: jsonb("incidents").$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    modifiedAt: now(),
  },
  (t) => ({
    uniq: uniqueIndex("att_emp_date_uniq").on(t.employeeId, t.workDate),
    dateIdx: index("att_date_idx").on(t.workDate),
    statusIdx: index("att_status_idx").on(t.status),
  })
);

export const holidays = pgTable("holidays", {
  id: id(),
  holidayDate: text("holiday_date").notNull().unique(),
  description: text("description").notNull(),
  isNational: boolean("is_national").notNull().default(true),
});

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default("default"),
  weekdayStart: text("weekday_start").notNull().default("08:30"),
  weekdayEnd: text("weekday_end").notNull().default("18:30"),
  weekdayHours: real("weekday_hours").notNull().default(9),
  saturdayStart: text("saturday_start").notNull().default("08:30"),
  saturdayEnd: text("saturday_end").notNull().default("14:00"),
  saturdayHours: real("saturday_hours").notNull().default(5.5),
  toleranceMinutes: integer("tolerance_minutes").notNull().default(5),
  duplicateThresholdMinutes: integer("duplicate_threshold_minutes").notNull().default(2),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/* =========================== Auth.js tables =========================== */
export const ROLES = ["admin", "rrhh", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
  image: text("image"),
  role: text("role").$type<Role>().notNull().default("viewer"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const accounts = pgTable(
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

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => ({ pk: uniqueIndex("vt_pk").on(t.identifier, t.token) })
);

export type User = typeof users.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type AttendanceDay = typeof attendanceDays.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
export type JustificationType = typeof justificationTypes.$inferSelect;
