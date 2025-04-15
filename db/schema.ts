import {
	pgTable,
	text,
	timestamp,
	uuid,
	jsonb,
	varchar,
	integer,
	boolean,
} from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
	id: uuid('id').defaultRandom().primaryKey(),

	// Basic user information
	email: text('email').notNull().unique(),
	firstName: varchar('first_name', { length: 100 }).notNull(),
	lastName: varchar('last_name', { length: 100 }).notNull(),
	phoneNumber: varchar('phone_number', { length: 20 }).notNull().unique(),
	accountType: text('account_type').notNull().default('regular'),
	preferences: jsonb('preferences').default({}),

	// Authentication
	password: text('password').notNull(),
	role: varchar('role', {
		length: 20,
		enum: ['user', 'admin', 'agent'],
	}).default('user'),
	isEmailVerified: boolean('is_email_verified').default(false),
	isPhoneVerified: boolean('is_phone_verified').default(false),

	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
});

export const verificationPoolTable = pgTable('verification_pool', {
	id: uuid('id').defaultRandom().primaryKey(),
	phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
	verificationCode: varchar('verification_code', { length: 6 }).notNull(),
	verificationStatus: varchar('verification_status', {
		length: 10,
		enum: ['pending', 'sent', 'verified', 'failed'],
	})
		.default('pending')
		.notNull(),
	verificationAttempts: integer('verification_attempts').default(0).notNull(),
	verificationSentAt: timestamp('verification_sent_at').notNull(),
	messageId: text('message_id'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
});

export type UserInsert = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;

export type VerificationPoolInsert = typeof verificationPoolTable.$inferInsert;
export type VerificationPool = typeof verificationPoolTable.$inferSelect;
