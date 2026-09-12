ALTER TABLE "users" ALTER COLUMN "telegram_chat_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_enabled_at" timestamp;