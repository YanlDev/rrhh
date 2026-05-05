CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`weekday_start` text DEFAULT '08:30' NOT NULL,
	`weekday_end` text DEFAULT '18:30' NOT NULL,
	`weekday_hours` real DEFAULT 9 NOT NULL,
	`saturday_start` text DEFAULT '08:30' NOT NULL,
	`saturday_end` text DEFAULT '14:00' NOT NULL,
	`saturday_hours` real DEFAULT 5.5 NOT NULL,
	`tolerance_minutes` integer DEFAULT 5 NOT NULL,
	`duplicate_threshold_minutes` integer DEFAULT 2 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch())
);
