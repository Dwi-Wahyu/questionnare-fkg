ALTER TABLE `surveys` ADD `period_type` enum('month','date') DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE `surveys` ADD `period_value` varchar(10);