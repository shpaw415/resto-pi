CREATE TABLE `courier_duty` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`courier_user_id` text NOT NULL,
	`punched_in` integer DEFAULT false NOT NULL,
	`punched_in_at` text,
	`punched_out_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`courier_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courier_duty_resto_user_idx` ON `courier_duty` (`restaurant_id`,`courier_user_id`);