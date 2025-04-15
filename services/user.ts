import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { usersTable, User, UserInsert } from '../db/schema';
import CustomError from '../utils/customError';

/**
 * Update user profile information
 */
export const updateUserProfile = async (
	userId: string,
	updateData: Partial<UserInsert>
): Promise<User> => {
	// Don't allow updating sensitive fields
	delete updateData.password;

	const updated = await db
		.update(usersTable)
		.set({
			...updateData,
			updatedAt: new Date(),
		})
		.where(eq(usersTable.id, userId))
		.returning();

	if (!updated || updated.length === 0) {
		throw CustomError.NotFound('User not found');
	}

	return updated[0];
};
