import { db } from '../db/client';
import { usersTable } from '../db/schema';
import requestHandler from '../utils/requestHandler';

export const getAllUsers = requestHandler(async () => {
	const results = await db.select().from(usersTable);
	return {
		data: results,
		message: 'Successfully retrieved all media',
	};
});
