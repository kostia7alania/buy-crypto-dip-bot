CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_user_id" text NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"username" text,
	"first_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_user_id_unique" UNIQUE("telegram_user_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "execute_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tg_message_id" bigint;--> statement-breakpoint
ALTER TABLE "strategies" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;