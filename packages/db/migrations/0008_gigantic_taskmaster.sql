CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"chat_id" text NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_error_code" text,
	"telegram_message_id" bigint,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_outbox_kind_check" CHECK ("notification_outbox"."kind" IN ('PLAIN', 'ORDER_PENDING')),
	CONSTRAINT "notification_outbox_status_check" CHECK ("notification_outbox"."status" IN ('PENDING', 'SENDING', 'DELIVERED', 'RETRY', 'FAILED', 'SKIPPED'))
);
--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_user_id_id_idx" ON "orders" USING btree ("user_id","id");--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_user_id_order_id_orders_user_id_id_fk" FOREIGN KEY ("user_id","order_id") REFERENCES "public"."orders"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_outbox_due_idx" ON "notification_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_outbox_user_created_at_idx" ON "notification_outbox" USING btree ("user_id","created_at");
