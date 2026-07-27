ALTER TABLE `survey_categories` ADD `require_period` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `survey_categories` ADD `enable_conditional` boolean DEFAULT false NOT NULL;