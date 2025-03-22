import { pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
	id: uuid('id').defaultRandom().primaryKey(),
	email: text('email').notNull().unique(),
	hashedPassword: text('hashed_password').notNull(),
	name: text('name').notNull(),
	accountType: text('account_type').notNull().default('regular'), // 'regular' or 'speaker'
	preferences: jsonb('preferences').default({}),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
});
