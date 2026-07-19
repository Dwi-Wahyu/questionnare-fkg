CREATE TABLE `survey_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(150) NOT NULL,
	`order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `survey_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `survey_categories_slug_unique` UNIQUE(`slug`)
);
