import { describe, it, expect, beforeEach } from 'vitest';
import {
	generateToken,
	verifyToken,
	hashPassword,
	comparePassword,
	findUserByPhoneNumber,
	findUserById,
	createUser,
	loginUser,
	changePassword,
	findVerificationByPhoneNumber,
	generateVerificationCode,
	createVerification,
	updateVerification,
	updateVerificationAttempts,
	updateVerificationStatus,
	sendVerificationCodeSMS,
} from '../../../services/auth';
import { db } from '../../../db/client';
import {
	createMockUser,
	createMockUserWithHashedPassword,
	createMockNewUser,
} from '../../factories/userFactory';
import {
	createMockNewVerification,
	createMockVerification,
} from '../../factories/verificationFactory';
import {
	User,
	UserInsert,
	usersTable,
	VerificationPool,
	VerificationPoolInsert,
	verificationPoolTable,
} from '../../../db/schema';
import { eq } from 'drizzle-orm';

let mockUser: User;
let mockUserWithHashedPassword: User;
let mockNewUser: UserInsert;
let mockVerification: VerificationPool;
let mockNewVerification: VerificationPoolInsert;

// Clean DB before each test
beforeEach(async () => {
	await db.execute(`TRUNCATE TABLE "users" RESTART IDENTITY CASCADE;`);
	await db.execute(
		`TRUNCATE TABLE "verification_pool" RESTART IDENTITY CASCADE;`
	);

	mockUser = createMockUser();
	mockUserWithHashedPassword = await createMockUserWithHashedPassword(mockUser);
	mockNewUser = createMockNewUser();
	mockVerification = createMockVerification();
	mockNewVerification = createMockNewVerification();

	await db.insert(usersTable).values(mockUserWithHashedPassword);
	await db.insert(verificationPoolTable).values(mockVerification);
});

describe('Auth Service', () => {
	// Test generateToken and verifyToken together
	describe('token management', () => {
		it('should generate a valid token that can be verified', () => {
			const userId = '123';
			const token = generateToken(userId);

			const decoded = verifyToken(token);
			expect(decoded.id).toBe(userId);
		});

		it('should throw on invalid token', () => {
			expect(() => verifyToken('invalid-token')).toThrow('Invalid token');
		});
	});

	// Test password hashing
	describe('password management', () => {
		it('should hash password and compare correctly', async () => {
			const password = 'myPassword123';
			const hashedPassword = await hashPassword(password);

			// Should not be the original password
			expect(hashedPassword).not.toBe(password);

			// Should verify correctly
			const isValid = await comparePassword(password, hashedPassword);
			expect(isValid).toBe(true);
		});

		it('should return false for incorrect password', async () => {
			const password = 'myPassword123';
			const hashedPassword = await hashPassword(password);

			const isValid = await comparePassword('wrongPassword', hashedPassword);
			expect(isValid).toBe(false);
		});
	});
});

describe('Auth Service - Token Management', () => {
	describe('generateToken', () => {
		it('should generate a valid JWT token', () => {
			const userId = 'test-user-123';
			const token = generateToken(userId);

			// Basic JWT structure validation
			expect(token).toBeDefined();
			expect(typeof token).toBe('string');
			expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
		});

		it('should generate different tokens for different users', () => {
			const userId1 = 'user-1';
			const userId2 = 'user-2';

			const token1 = generateToken(userId1);
			const token2 = generateToken(userId2);

			expect(token1).not.toBe(token2);
		});
	});

	describe('verifyToken', () => {
		it('should verify a valid token and return the correct user ID', () => {
			const userId = 'test-user-123';
			const token = generateToken(userId);

			const decoded = verifyToken(token);
			expect(decoded.id).toBe(userId);
		});

		it('should throw error for invalid token', () => {
			expect(() => verifyToken('invalid-token')).toThrow('Invalid token');
		});

		it('should throw error for expired token', () => {
			// Create an expired token by modifying the payload
			const expiredToken =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtdXNlci0xMjMiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTUxNjIzOTAyM30.invalid-signature';

			expect(() => verifyToken(expiredToken)).toThrow(
				'Invalid token or token expired'
			);
		});
	});
});

describe('Auth Service - Password Management', () => {
	describe('hashPassword', () => {
		it('should hash password with consistent length', async () => {
			const password = 'myPassword123';
			const hashedPassword = await hashPassword(password);

			// bcrypt hashed passwords are always 60 characters
			expect(hashedPassword.length).toBe(60);
		});

		it('should generate different hashes for same password', async () => {
			const password = 'myPassword123';
			const hash1 = await hashPassword(password);
			const hash2 = await hashPassword(password);

			// Due to different salts, hashes should be different
			expect(hash1).not.toBe(hash2);
		});

		it('should handle empty password', async () => {
			const hashedPassword = await hashPassword('');
			expect(hashedPassword).toBeDefined();
			expect(hashedPassword.length).toBe(60);
		});
	});

	describe('comparePassword', () => {
		it('should correctly verify password against its hash', async () => {
			const password = 'myPassword123';
			const hashedPassword = await hashPassword(password);

			const isValid = await comparePassword(password, hashedPassword);
			expect(isValid).toBe(true);
		});

		it('should return false for incorrect password', async () => {
			const password = 'myPassword123';
			const hashedPassword = await hashPassword(password);

			const isValid = await comparePassword('wrongPassword', hashedPassword);
			expect(isValid).toBe(false);
		});

		it('should handle empty password comparison', async () => {
			const hashedPassword = await hashPassword('');
			const isValid = await comparePassword('', hashedPassword);
			expect(isValid).toBe(true);
		});

		it('should handle null/undefined inputs', async () => {
			const hashedPassword = await hashPassword('password');

			// @ts-expect-error Testing invalid input
			await expect(comparePassword(null, hashedPassword)).rejects.toThrow();
			// @ts-expect-error Testing invalid input
			await expect(comparePassword('password', null)).rejects.toThrow();
		});
	});
});

describe('Auth Service - User Operations', () => {
	describe('findUserByPhoneNumber', () => {
		it('should return user when found', async () => {
			const user = await findUserByPhoneNumber(mockUser.phoneNumber);
			expect(user).toEqual(mockUserWithHashedPassword);
		});

		it('should return undefined when user not found', async () => {
			const user = await findUserByPhoneNumber('non-existent-phone-number');
			expect(user).toBeUndefined();
		});
	});

	describe('findUserById', () => {
		it('should return user when found', async () => {
			const user = await findUserById(mockUser.id);
			expect(user).toEqual(mockUserWithHashedPassword);
		});

		it('should return undefined when user not found', async () => {
			const user = await findUserById('7a460058-82a5-4635-97d3-43133903063e');
			expect(user).toBeUndefined();
		});
	});

	describe('createUser', () => {
		it('should create user', async () => {
			const createdUser = await createUser(mockNewUser);
			expect(createdUser).toEqual(mockNewUser);
		});
	});

	describe('loginUser', () => {
		it('should login user with correct credentials', async () => {
			const result = await loginUser(mockUser.phoneNumber, mockUser.password);
			const user = await findUserByPhoneNumber(mockUser.phoneNumber);
			expect(result.user).toEqual(user);
			expect(result.token).toContain('ey');
		});

		it('should throw error with incorrect credentials', async () => {
			await expect(
				loginUser(mockUser.phoneNumber, 'wrong-password')
			).rejects.toThrow('Incorrect phone number or password');
		});
	});

	describe('changePassword', () => {
		it('should change password when current password is correct', async () => {
			const result = await changePassword(
				mockUser.id,
				mockUser.password,
				'new-password'
			);
			const user = await findUserById(mockUser.id);
			expect(result).toEqual(user);
		});

		it('should throw error when current password is incorrect', async () => {
			await expect(
				changePassword(mockUser.id, 'wrong-password', 'new-password')
			).rejects.toThrow('Current password is incorrect');
		});
	});
});

describe('Auth Service - Verification Flow', () => {
	describe('generateVerificationCode', () => {
		it('should generate a 6-digit code', () => {
			const code = generateVerificationCode();
			expect(code).toMatch(/^\d{6}$/);
		});

		it('should generate different codes on each call', () => {
			const code1 = generateVerificationCode();
			const code2 = generateVerificationCode();
			expect(code1).not.toBe(code2);
		});
	});

	describe('createVerification', () => {
		it('should create a new verification entry', async () => {
			const verificationId = await createVerification(
				mockNewVerification.phoneNumber,
				mockNewVerification.verificationCode
			);
			const verification = await findVerificationByPhoneNumber(
				mockNewVerification.phoneNumber
			);
			expect(verificationId).toBe(verification?.id);
		});
	});

	describe('findVerificationByPhoneNumber', () => {
		it('should return verification when found', async () => {
			const verification = await findVerificationByPhoneNumber(
				mockVerification.phoneNumber
			);
			expect(verification).toEqual(mockVerification);
		});

		it('should return undefined when verification not found', async () => {
			const verification = await findVerificationByPhoneNumber('non-existent');
			expect(verification).toBeUndefined();
		});
	});

	describe('updateVerification', () => {
		it('should update verification code', async () => {
			const newCode = '654321';

			const verificationId = await updateVerification(
				mockVerification.id,
				newCode
			);
			expect(verificationId).toBe(mockVerification.id);
		});

		it('should throw error when update fails', async () => {
			await expect(
				updateVerification(mockVerification.id, 'invalid-6-digit-code')
			).rejects.toThrow();
		});
	});

	describe('updateVerificationAttempts', () => {
		it('should update verification attempts', async () => {
			const newAttempts = 1;

			await updateVerificationAttempts(mockVerification.id, newAttempts);
			const verification = await findVerificationByPhoneNumber(
				mockVerification.phoneNumber
			);
			expect(verification?.verificationAttempts).toEqual(2);
		});
	});

	describe('updateVerificationStatus', () => {
		it('should update verification status', async () => {
			const newStatus = 'verified' as const;

			await updateVerificationStatus(mockVerification.id, newStatus);
			const verification = (
				await db
					.select({ status: verificationPoolTable.verificationStatus })
					.from(verificationPoolTable)
					.where(eq(verificationPoolTable.id, mockVerification.id))
			)[0];
			expect(verification?.status).toEqual(newStatus);
		});
	});

	describe('sendVerificationCodeSMS', () => {
		it('should send SMS with verification code', async () => {
			expect(
				sendVerificationCodeSMS(
					mockVerification.phoneNumber,
					mockVerification.verificationCode,
					mockVerification.id
				)
			).resolves.not.toThrow();
		});
	});
});
