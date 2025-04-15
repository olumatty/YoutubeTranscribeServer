import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({
	path: path.resolve(process.cwd(), '.env'),
});

import { optionalEnvVars, requiredEnvVars } from '../config/env';

// Validate environment variables
function validateEnv(): void {
	console.log('Validating environment variables...');

	const missingVars: string[] = [];

	// Check required variables
	requiredEnvVars.forEach((envVar) => {
		if (!process.env[envVar]) {
			missingVars.push(envVar);
		}
	});

	// Set defaults for optional variables if not present
	Object.entries(optionalEnvVars).forEach(([envVar, defaultValue]) => {
		if (!process.env[envVar]) {
			process.env[envVar] = defaultValue.toString();
			console.log(`Setting default value for ${envVar}: ${defaultValue}`);
		}
	});

	// Report missing variables
	if (missingVars.length > 0) {
		console.error('\nMissing required environment variables:');
		missingVars.forEach((v) => console.error(`- ${v}`));
		console.error('\nPlease set these variables in your .env file.');
		process.exit(1); // Exit the process with an error code
	}

	console.log('Environment validation successful!');
}

// Run validation when this module is imported
validateEnv();
