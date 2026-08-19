CREATE TABLE `courier_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`courier_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`courier_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
