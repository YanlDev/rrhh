CREATE TABLE `attendance_days` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`work_date` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`is_workday` integer NOT NULL,
	`raw_punches` text NOT NULL,
	`corrected_punches` text,
	`justification_id` text,
	`justification_note` text,
	`effective_punches` text NOT NULL,
	`status` text NOT NULL,
	`check_in` text,
	`check_out` text,
	`worked_minutes` integer,
	`late_minutes` integer DEFAULT 0 NOT NULL,
	`early_leave_minutes` integer DEFAULT 0 NOT NULL,
	`incidents` text DEFAULT ('[]') NOT NULL,
	`ts` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`justification_id`) REFERENCES `justification_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `att_emp_date_uniq` ON `attendance_days` (`employee_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `att_date_idx` ON `attendance_days` (`work_date`);--> statement-breakpoint
CREATE INDEX `att_status_idx` ON `attendance_days` (`status`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`name` text NOT NULL,
	`department` text,
	`active` integer DEFAULT true NOT NULL,
	`first_seen_at` integer DEFAULT (unixepoch()),
	`last_seen_at` integer DEFAULT (unixepoch()),
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_person_id_unique` ON `employees` (`person_id`);--> statement-breakpoint
CREATE INDEX `emp_dept_idx` ON `employees` (`department`);--> statement-breakpoint
CREATE INDEX `emp_active_idx` ON `employees` (`active`);--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`holiday_date` text NOT NULL,
	`description` text NOT NULL,
	`is_national` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holidays_holiday_date_unique` ON `holidays` (`holiday_date`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`total_rows` integer NOT NULL,
	`employees_count` integer NOT NULL,
	`days_count` integer NOT NULL,
	`uploaded_at` integer DEFAULT (unixepoch()),
	`raw_snapshot` text
);
--> statement-breakpoint
CREATE TABLE `justification_types` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`label_es` text NOT NULL,
	`counts_as_worked` integer DEFAULT true NOT NULL,
	`color` text,
	`icon` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `justification_types_code_unique` ON `justification_types` (`code`);