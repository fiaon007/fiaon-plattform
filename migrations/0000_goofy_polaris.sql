CREATE TABLE "admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" varchar NOT NULL,
	"target_user_id" varchar,
	"action" varchar NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"date" varchar NOT NULL,
	"time" varchar NOT NULL,
	"duration" integer DEFAULT 60 NOT NULL,
	"location" varchar,
	"attendees" text,
	"type" varchar DEFAULT 'meeting' NOT NULL,
	"status" varchar DEFAULT 'scheduled' NOT NULL,
	"call_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"lead_id" integer,
	"voice_agent_id" integer,
	"phone_number" varchar NOT NULL,
	"contact_name" varchar,
	"retell_call_id" varchar,
	"status" varchar DEFAULT 'initiated',
	"duration" integer,
	"transcript" text,
	"custom_prompt" text,
	"recording_url" varchar,
	"metadata" jsonb,
	"processed_for_calendar" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "call_logs_retell_call_id_unique" UNIQUE("retell_call_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'draft',
	"total_leads" integer DEFAULT 0,
	"contacted" integer DEFAULT 0,
	"converted" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"is_ai" boolean DEFAULT false,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar DEFAULT 'New Chat',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"company" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"phone" varchar,
	"email" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_briefings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"mode" varchar DEFAULT 'cached' NOT NULL,
	"payload" jsonb NOT NULL,
	"sources" jsonb,
	"personalization" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"type" varchar NOT NULL,
	"rating" integer,
	"title" varchar,
	"description" text NOT NULL,
	"screenshot" text,
	"page_url" varchar NOT NULL,
	"user_agent" text,
	"browser_info" jsonb,
	"status" varchar DEFAULT 'new',
	"priority" varchar DEFAULT 'medium',
	"assigned_to" varchar,
	"tags" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "internal_call_logs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"contact_id" varchar,
	"source" varchar DEFAULT 'OTHER' NOT NULL,
	"external_call_id" varchar,
	"phone_number" varchar,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"duration_seconds" integer,
	"outcome" varchar,
	"sentiment" varchar,
	"summary" text,
	"recording_url" varchar,
	"raw_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_companies" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"website" varchar,
	"industry" varchar,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_contacts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar,
	"phone" varchar,
	"position" varchar,
	"company_id" varchar,
	"source" varchar,
	"status" varchar DEFAULT 'NEW' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_deals" (
	"id" varchar PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"value" integer,
	"currency" varchar DEFAULT 'EUR' NOT NULL,
	"stage" varchar DEFAULT 'IDEA' NOT NULL,
	"contact_id" varchar,
	"company_id" varchar,
	"owner_user_id" varchar,
	"probability" integer,
	"close_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_notes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"contact_id" varchar,
	"deal_id" varchar,
	"author_user_id" varchar,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_tasks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'OPEN' NOT NULL,
	"due_date" timestamp,
	"assigned_user_id" varchar,
	"related_contact_id" varchar,
	"related_deal_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar,
	"phone" varchar,
	"company" varchar,
	"status" varchar DEFAULT 'cold',
	"last_contact" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"target_type" varchar,
	"target_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"price" integer NOT NULL,
	"ai_messages_limit" integer,
	"voice_calls_limit" integer,
	"leads_limit" integer,
	"campaigns_limit" integer,
	"features" text[],
	"stripe_price_id" varchar,
	"stripe_product_id" varchar,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "team_calendar" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"all_day" boolean DEFAULT false,
	"location" varchar,
	"color" varchar DEFAULT '#FE9100',
	"event_type" varchar DEFAULT 'INTERN',
	"is_read_only" boolean DEFAULT false,
	"visibility" varchar DEFAULT 'TEAM',
	"recurrence" jsonb,
	"internal_notes" text,
	"context_tags" jsonb,
	"created_by_user_id" varchar NOT NULL,
	"updated_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_calendar_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"role_label" varchar,
	"status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_chat_channel_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar DEFAULT 'member',
	"last_read_at" timestamp,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_chat_channels" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"type" varchar DEFAULT 'public',
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"reply_to_id" integer,
	"attachments" jsonb,
	"edited_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_feed" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_user_id" varchar NOT NULL,
	"type" varchar DEFAULT 'note' NOT NULL,
	"message" text NOT NULL,
	"category" varchar,
	"target_type" varchar,
	"target_id" varchar,
	"target_name" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_todos" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"due_at" timestamp,
	"priority" varchar DEFAULT 'medium',
	"status" varchar DEFAULT 'pending',
	"assigned_to_user_id" varchar,
	"created_by_user_id" varchar NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twilio_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"account_sid" varchar,
	"auth_token" varchar,
	"phone_number" varchar,
	"configured" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_data_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar,
	"status" varchar DEFAULT 'active' NOT NULL,
	"content_text" text,
	"url" text,
	"file_name" varchar,
	"file_mime" varchar,
	"file_size" integer,
	"file_storage_key" varchar,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tasks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"source_type" varchar NOT NULL,
	"source_id" varchar,
	"fingerprint" varchar NOT NULL,
	"title" varchar(180) NOT NULL,
	"details" text,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"due_at" timestamp,
	"snoozed_until" timestamp,
	"status" varchar DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"username" varchar NOT NULL,
	"password" varchar NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"subscription_plan" varchar DEFAULT 'starter',
	"subscription_status" varchar DEFAULT 'trial_pending',
	"subscription_start_date" timestamp DEFAULT now(),
	"subscription_end_date" timestamp,
	"trial_start_date" timestamp,
	"trial_end_date" timestamp,
	"trial_messages_used" integer DEFAULT 0,
	"has_payment_method" boolean DEFAULT false,
	"stripe_payment_method_id" varchar,
	"ai_messages_used" integer DEFAULT 0,
	"voice_calls_used" integer DEFAULT 0,
	"monthly_reset_date" timestamp DEFAULT now(),
	"thread_id" varchar,
	"assistant_id" varchar,
	"company" varchar,
	"website" varchar,
	"industry" varchar,
	"job_role" varchar,
	"phone" varchar,
	"user_role" varchar DEFAULT 'user' NOT NULL,
	"language" varchar DEFAULT 'de',
	"primary_goal" varchar,
	"ai_profile" jsonb,
	"profile_enriched" boolean DEFAULT false,
	"last_enrichment_date" timestamp,
	"notification_settings" jsonb,
	"privacy_settings" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "voice_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" varchar NOT NULL,
	"description" text,
	"voice" varchar NOT NULL,
	"personality" text,
	"custom_script" text,
	"tts_voice" varchar DEFAULT 'nova',
	"language" varchar DEFAULT 'en',
	"industry" varchar,
	"is_system_agent" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"task_name" varchar(255) NOT NULL,
	"task_prompt" text NOT NULL,
	"phone_number" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"call_id" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"executed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_voice_agent_id_voice_agents_id_fk" FOREIGN KEY ("voice_agent_id") REFERENCES "public"."voice_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_briefings" ADD CONSTRAINT "daily_briefings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_call_logs" ADD CONSTRAINT "internal_call_logs_contact_id_internal_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."internal_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_contacts" ADD CONSTRAINT "internal_contacts_company_id_internal_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."internal_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_deals" ADD CONSTRAINT "internal_deals_contact_id_internal_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."internal_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_deals" ADD CONSTRAINT "internal_deals_company_id_internal_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."internal_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_deals" ADD CONSTRAINT "internal_deals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_contact_id_internal_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."internal_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_deal_id_internal_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."internal_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_related_contact_id_internal_contacts_id_fk" FOREIGN KEY ("related_contact_id") REFERENCES "public"."internal_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_related_deal_id_internal_deals_id_fk" FOREIGN KEY ("related_deal_id") REFERENCES "public"."internal_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_activity_log" ADD CONSTRAINT "staff_activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_calendar" ADD CONSTRAINT "team_calendar_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_calendar" ADD CONSTRAINT "team_calendar_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_calendar_participants" ADD CONSTRAINT "team_calendar_participants_event_id_team_calendar_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."team_calendar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_calendar_participants" ADD CONSTRAINT "team_calendar_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_chat_channel_members" ADD CONSTRAINT "team_chat_channel_members_channel_id_team_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."team_chat_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_chat_channel_members" ADD CONSTRAINT "team_chat_channel_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_chat_channels" ADD CONSTRAINT "team_chat_channels_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_chat_messages" ADD CONSTRAINT "team_chat_messages_channel_id_team_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."team_chat_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_chat_messages" ADD CONSTRAINT "team_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_feed" ADD CONSTRAINT "team_feed_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_todos" ADD CONSTRAINT "team_todos_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_todos" ADD CONSTRAINT "team_todos_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twilio_settings" ADD CONSTRAINT "twilio_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_data_sources" ADD CONSTRAINT "user_data_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tasks" ADD CONSTRAINT "user_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_agents" ADD CONSTRAINT "voice_agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_log_actor_idx" ON "admin_audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_idx" ON "admin_audit_log" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_action_idx" ON "admin_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "daily_briefings_user_id_idx" ON "daily_briefings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "daily_briefings_user_mode_idx" ON "daily_briefings" USING btree ("user_id","mode");--> statement-breakpoint
CREATE INDEX "daily_briefings_expires_at_idx" ON "daily_briefings" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "internal_call_logs_contact_idx" ON "internal_call_logs" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "internal_call_logs_phone_idx" ON "internal_call_logs" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "internal_call_logs_timestamp_idx" ON "internal_call_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "internal_companies_name_idx" ON "internal_companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "internal_contacts_email_idx" ON "internal_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "internal_contacts_phone_idx" ON "internal_contacts" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "internal_contacts_company_idx" ON "internal_contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "internal_deals_stage_idx" ON "internal_deals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "internal_deals_owner_idx" ON "internal_deals" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "internal_notes_contact_idx" ON "internal_notes" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "internal_notes_deal_idx" ON "internal_notes" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "internal_tasks_status_idx" ON "internal_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "internal_tasks_assigned_idx" ON "internal_tasks" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "internal_tasks_due_date_idx" ON "internal_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "staff_activity_log_user_idx" ON "staff_activity_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "staff_activity_log_created_idx" ON "staff_activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "team_calendar_starts_idx" ON "team_calendar" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "team_calendar_creator_idx" ON "team_calendar" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "team_calendar_event_type_idx" ON "team_calendar" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "team_calendar_participants_event_idx" ON "team_calendar_participants" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "team_calendar_participants_user_idx" ON "team_calendar_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_chat_members_channel_idx" ON "team_chat_channel_members" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "team_chat_members_user_idx" ON "team_chat_channel_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_chat_channels_type_idx" ON "team_chat_channels" USING btree ("type");--> statement-breakpoint
CREATE INDEX "team_chat_channels_created_idx" ON "team_chat_channels" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "team_chat_messages_channel_idx" ON "team_chat_messages" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "team_chat_messages_user_idx" ON "team_chat_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_chat_messages_created_idx" ON "team_chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "team_feed_author_idx" ON "team_feed" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "team_feed_created_idx" ON "team_feed" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "team_feed_type_idx" ON "team_feed" USING btree ("type");--> statement-breakpoint
CREATE INDEX "team_todos_status_idx" ON "team_todos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "team_todos_due_idx" ON "team_todos" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "team_todos_assigned_idx" ON "team_todos" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "team_todos_creator_idx" ON "team_todos" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "user_data_sources_user_id_idx" ON "user_data_sources" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_data_sources_user_created_idx" ON "user_data_sources" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_data_sources_type_idx" ON "user_data_sources" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "user_tasks_user_id_idx" ON "user_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_tasks_user_status_idx" ON "user_tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_tasks_user_source_idx" ON "user_tasks" USING btree ("user_id","source_type");--> statement-breakpoint
CREATE INDEX "user_tasks_fingerprint_idx" ON "user_tasks" USING btree ("user_id","fingerprint");--> statement-breakpoint
CREATE INDEX "user_tasks_due_at_idx" ON "user_tasks" USING btree ("due_at");