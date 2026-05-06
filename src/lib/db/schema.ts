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
    overtimeMinutes: integer("overtime_minutes").notNull().default(0),
    undertimeMinutes: integer("undertime_minutes").notNull().default(0),
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

export const scheduleOverrides = pgTable(
  "schedule_overrides",
  {
    workDate: text("work_date").primaryKey(), // 'YYYY-MM-DD'
    description: text("description").notNull(),
    startTime: text("start_time").notNull().default("08:30"),
    endTime: text("end_time").notNull(),
    hours: real("hours").notNull(),
    lunchMinutes: integer("lunch_minutes").notNull().default(0),
    lunchWindowStart: text("lunch_window_start").notNull().default("12:00"),
    lunchWindowEnd: text("lunch_window_end").notNull().default("14:00"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dateIdx: index("schedule_overrides_date_idx").on(t.workDate),
  })
);

export const schedulePeriods = pgTable(
  "schedule_periods",
  {
    id: id(),
    effectiveFrom: text("effective_from").notNull().unique(), // 'YYYY-MM-DD'
    weekdayStart: text("weekday_start").notNull().default("08:30"),
    weekdayEnd: text("weekday_end").notNull().default("18:30"),
    weekdayHours: real("weekday_hours").notNull().default(9),
    weekdayLunchMinutes: integer("weekday_lunch_minutes").notNull().default(60),
    saturdayStart: text("saturday_start").notNull().default("08:30"),
    saturdayEnd: text("saturday_end").notNull().default("14:00"),
    saturdayHours: real("saturday_hours").notNull().default(5.5),
    saturdayLunchMinutes: integer("saturday_lunch_minutes").notNull().default(0),
    toleranceMinutes: integer("tolerance_minutes").notNull().default(5),
    duplicateThresholdMinutes: integer("duplicate_threshold_minutes").notNull().default(2),
    minLunchMinutes: integer("min_lunch_minutes").notNull().default(25),
    lunchWindowStart: text("lunch_window_start").notNull().default("12:00"),
    lunchWindowEnd: text("lunch_window_end").notNull().default("14:00"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    fromIdx: index("schedule_periods_from_idx").on(t.effectiveFrom),
  })
);

/* =========================== Auth local (username + password) =========================== */
export const ROLES = ["admin", "rrhh", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const users = pgTable(
  "users",
  {
    id: id(),
    username: text("username").notNull().unique(),
    name: text("name").notNull(),
    role: text("role").$type<Role>().notNull().default("viewer"),
    active: boolean("active").notNull().default(true),
    passwordHash: text("password_hash").notNull(),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => ({
    usernameIdx: index("users_username_idx").on(t.username),
  })
);

export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ip: text("ip"),
  },
  (t) => ({
    userIdx: index("sessions_user_id_idx").on(t.userId),
    expiresIdx: index("sessions_expires_at_idx").on(t.expiresAt),
  })
);

/* =========================== Tipos exportados =========================== */
export type SchedulePeriod = typeof schedulePeriods.$inferSelect;
export type ScheduleOverride = typeof scheduleOverrides.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type AttendanceDay = typeof attendanceDays.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
export type JustificationType = typeof justificationTypes.$inferSelect;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
