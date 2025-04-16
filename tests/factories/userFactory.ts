import { randomUUID } from 'crypto';
import { User, UserInsert } from '../../db/schema';
import { hashPassword } from '../../services/auth';

export const createMockUser = (): User => {
	const now = new Date();
	return {
		id: randomUUID(),
		phoneNumber: '+1234567890',
		email: 'test@example.com',
		firstName: 'Test',
		lastName: 'User',
		password: 'hashedPassword123',
		accountType: 'user',
		preferences: {},
		role: 'user',
		isEmailVerified: false,
		isPhoneVerified: false,
		createdAt: now,
		updatedAt: now,
	};
};

export const createMockUserWithHashedPassword = async (
	user: User
): Promise<User> => {
	const hashedPassword = await hashPassword(user.password);
	return {
		...user,
		password: hashedPassword,
	};
};

export const createMockNewUser = (): UserInsert => {
	const now = new Date();
	return {
		id: randomUUID(),
		phoneNumber: '+2345678901',
		email: 'test2@example.com',
		firstName: 'Test',
		lastName: 'User',
		password: 'plainPassword123',
		accountType: 'user',
		preferences: {},
		role: 'user' as const,
		isEmailVerified: false,
		isPhoneVerified: false,
		createdAt: now,
		updatedAt: now,
	};
};

export const createMockInvalidUser = (): UserInsert => {
	return {
		phoneNumber: 2345678901 as unknown as string,
		email: 'test2@example.com',
		firstName: 'Test',
		lastName: 'User',
		password: 'plainPassword123',
		accountType: 'user',
		role: 'user' as const,
		isEmailVerified: false,
		isPhoneVerified: false,
	};
};
