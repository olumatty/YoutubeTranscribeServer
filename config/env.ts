import { config } from 'dotenv';
import { join, resolve } from 'path';

const projectRootDir = resolve();

const path = join(
  projectRootDir,
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : process.env.NODE_ENV === 'staging'
      ? '.env.staging'
      : '.env',
);

// Load Environmental Variables
config({ path });
