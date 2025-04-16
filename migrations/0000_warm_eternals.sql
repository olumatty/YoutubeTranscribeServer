CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"account_type" text DEFAULT 'regular' NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"password" text NOT NULL,
	"role" varchar(20) DEFAULT 'user',
	"is_email_verified" boolean DEFAULT false,
	"is_phone_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "verification_pool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"verification_code" varchar(6) NOT NULL,
	"verification_status" varchar(10) DEFAULT 'pending' NOT NULL,
	"verification_attempts" integer DEFAULT 0 NOT NULL,
	"verification_sent_at" timestamp NOT NULL,
	"message_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
