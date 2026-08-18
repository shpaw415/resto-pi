CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`revoked_at` text,
	`last_used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `courier_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`courier_user_id` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`recorded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`courier_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`courier_user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`courier_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `order_item_extras` (
	`id` text PRIMARY KEY NOT NULL,
	`order_item_id` text NOT NULL,
	`extra_value_id` text,
	`name_snapshot` text NOT NULL,
	`price_cents_delta` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`extra_value_id`) REFERENCES `product_extra_values`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text,
	`variant_id` text,
	`name_snapshot` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_cents` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `order_status_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`actor_user_id` text,
	`actor_label` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'en_attente' NOT NULL,
	`source` text DEFAULT 'api' NOT NULL,
	`external_pos_id` text,
	`customer_name` text,
	`customer_phone` text,
	`customer_address` text,
	`notes` text,
	`subtotal_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `pos_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`adapter` text DEFAULT 'mock' NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_extra_values` (
	`id` text PRIMARY KEY NOT NULL,
	`extra_id` text NOT NULL,
	`name` text NOT NULL,
	`price_cents_delta` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`extra_id`) REFERENCES `product_extras`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_extras` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`max_select` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`price_cents` integer NOT NULL,
	`sku` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`description` text,
	`image_url` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `restaurants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`phone` text,
	`lat` real,
	`lng` real,
	`timezone` text DEFAULT 'America/Toronto' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_slug_idx` ON `restaurants` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`name` text,
	`issuer_role` text,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
