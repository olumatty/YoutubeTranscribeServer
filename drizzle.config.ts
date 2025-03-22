import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load DB configuration
config();

const drizzleConfig = defineConfig({
	schema: './db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
	verbose: process.env.NODE_ENV !== 'production',
	strict: true,
	out: './migrations',
});

export default drizzleConfig;
