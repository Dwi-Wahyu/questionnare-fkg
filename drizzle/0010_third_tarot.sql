CREATE TABLE `visitor_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitor_id` varchar(100) NOT NULL,
	`path` varchar(255),
	`visited_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visitor_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `visitor_logs_visitor_idx` ON `visitor_logs` (`visitor_id`);--> statement-breakpoint
CREATE INDEX `visitor_logs_visited_at_idx` ON `visitor_logs` (`visited_at`);