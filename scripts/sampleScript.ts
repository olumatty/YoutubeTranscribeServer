import * as dotenv from 'dotenv';

dotenv.config();

import { db } from '../db/client';
import { usersTable } from '../db/schema';
import { runScript } from '../utils/scripts';

const users = [];

async function uploadUsers() {
	await db.insert(usersTable).values(users);
}

runScript(uploadUsers);
