// Create a typed access method to get environment variables
function getEnv<T = string>(key: string, defaultValue?: T): T {
	const value = process.env[key];

	if (value === undefined) {
		if (defaultValue !== undefined) {
			return defaultValue;
		}
		throw new Error(
			`Environment variable ${key} is not defined and no default value was provided`
		);
	}

	// Handle type conversion based on defaultValue type
	if (defaultValue !== undefined) {
		const type = typeof defaultValue;
		if (type === 'number') {
			const numValue = Number(value);
			return (isNaN(numValue) ? defaultValue : numValue) as unknown as T;
		}
		if (type === 'boolean') {
			return (value.toLowerCase() === 'true') as unknown as T;
		}
	}

	return value as unknown as T;
}

// Helper functions for environment mode
function isDevelopment(): boolean {
	return getEnv('NODE_ENV', 'development') === 'development';
}

function isProduction(): boolean {
	return getEnv<string>('NODE_ENV', 'development') === 'production';
}

// Export environment configuration with flattened structure
export const env = {
	// Server
	PORT: getEnv('PORT', 4000),
	NODE_ENV: getEnv('NODE_ENV', 'development'),
	ALLOWED_ORIGINS: getEnv('ALLOWED_ORIGINS', 'http://localhost:3000').split(
		','
	),
	isDevelopment,
	isProduction,

	// Database
	DATABASE_URL: getEnv('DATABASE_URL'),

	// Auth
	JWT_SECRET: getEnv('JWT_SECRET'),
	JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN', '7d'),
	JWT_COOKIE_EXPIRES_IN: getEnv('JWT_COOKIE_EXPIRES_IN', 7),

	// SMS
	AT_API_KEY: getEnv('AT_API_KEY'),
	AT_USERNAME: getEnv('AT_USERNAME'),

	// Backblaze B2 Storage
	B2_APPLICATION_KEY_ID: getEnv('B2_APPLICATION_KEY_ID'),
	B2_APPLICATION_KEY: getEnv('B2_APPLICATION_KEY'),
	B2_BUCKET_ID: getEnv('B2_BUCKET_ID'),
	B2_BUCKET_NAME: getEnv('B2_BUCKET_NAME'),
};

export const requiredEnvVars: (keyof typeof env)[] = [
	// Database
	'DATABASE_URL',

	// Auth
	'JWT_SECRET',

	// SMS
	'AT_API_KEY',
	'AT_USERNAME',

	// Backblaze B2 Storage
	'B2_APPLICATION_KEY_ID',
	'B2_APPLICATION_KEY',
	'B2_BUCKET_ID',
	'B2_BUCKET_NAME',
];

// Optional environment variables with default values
export const optionalEnvVars: Partial<
	Record<
		keyof typeof env,
		string | number | boolean | string[] | number[] | boolean[]
	>
> = {
	// Server
	PORT: 4000,
	NODE_ENV: 'development',
	ALLOWED_ORIGINS: 'http://localhost:3000',

	// Auth
	JWT_EXPIRES_IN: '7d',
	JWT_COOKIE_EXPIRES_IN: 7,
};
