CREATE TABLE `report_generations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`survey_id` int NOT NULL,
	`user_id` int NOT NULL,
	`generated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_generations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `report_generations` ADD CONSTRAINT `report_generations_survey_id_surveys_id_fk` FOREIGN KEY (`survey_id`) REFERENCES `surveys`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_generations` ADD CONSTRAINT `report_generations_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;