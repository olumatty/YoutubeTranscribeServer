import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
config({ path: resolve(process.cwd(), '.env') });

import { validateEnv } from '../config/env';

// Run validation where this module is imported
validateEnv();
