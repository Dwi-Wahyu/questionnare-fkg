ALTER TABLE `questions` ADD `conditional_parent_question_id` int;--> statement-breakpoint
ALTER TABLE `questions` ADD `conditional_parent_option_ids` json;--> statement-breakpoint
ALTER TABLE `questions` ADD CONSTRAINT `questions_conditional_parent_question_id_questions_id_fk` FOREIGN KEY (`conditional_parent_question_id`) REFERENCES `questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `questions_conditional_parent_question_idx` ON `questions` (`conditional_parent_question_id`);