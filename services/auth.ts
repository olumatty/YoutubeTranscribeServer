import bcrypt from 'bcrypt';
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { eq, and, inArray, desc, getTableColumns } from 'drizzle-orm';
import { db } from '../db/client';
import {
	usersTable,
	User,
	UserInsert,
	VerificationPool,
	verificationPoolTable,
} from '../db/schema';
import CustomError from '../utils/customError';
import { env } from '../config/env';
import { sendMessage } from './sms';

/**
 * Generate a JWT token for a user
 */
export const generateToken = (id: string): string => {
	const payload = { id };
	const secret = Buffer.from(env.JWT_SECRET, 'utf-8');
	const options: SignOptions = {
		expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
	};

	return jwt.sign(payload, secret, options);
};

/**
 * Verify a JWT token and return the decoded payload
 */
export const verifyToken = (token: string): { id: string } => {
	try {
		const secret = Buffer.from(env.JWT_SECRET, 'utf-8');
		const decoded = jwt.verify(token, secret) as JwtPayload;
		if (!decoded.id) {
			throw CustomError.Unauthorized('Invalid token payload');
		}
		return { id: decoded.id as string };
	} catch (error) {
		throw CustomError.Unauthorized('Invalid token or token expired');
	}
};

/**
 * Hash a password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
	const saltRounds = 12;
	return bcrypt.hash(password, saltRounds);
};

/**
 * Compare a plain password with a hashed password
 */
export const comparePassword = async (
	plainPassword: string,
	hashedPassword: string
): Promise<boolean> => {
	return bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Find a user by phone number
 */
export const findUserByPhoneNumber = async (
	phoneNumber: string
): Promise<User | undefined> => {
	const users = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.phoneNumber, phoneNumber));

	return users.length > 0 ? users[0] : undefined;
};

/**
 * Find a user by ID
 */
export const findUserById = async (id: string): Promise<User | undefined> => {
	const user = (
		await db.select().from(usersTable).where(eq(usersTable.id, id))
	)[0];

	return user;
};

/**
 * Create a new user
 */
export const createUser = async (
	userData: Omit<UserInsert, 'id' | 'createdAt' | 'updatedAt'>
): Promise<User> => {
	// Hash the password before storing it
	if (userData.password) {
		userData.password = await hashPassword(userData.password);
	}

	// Insert the new user into the database
	const inserted = await db.insert(usersTable).values(userData).returning();

	if (!inserted || inserted.length === 0) {
		throw CustomError.InternalServerError('Failed to create user');
	}

	return inserted[0];
};

/**
 * Login a user with phone number and password
 */
export const loginUser = async (
	phoneNumber: string,
	password: string
): Promise<{ user: User; token: string }> => {
	// Find the user by phone number
	const user = await findUserByPhoneNumber(phoneNumber);

	// Check if user exists and password is correct
	if (!user || !(await comparePassword(password, user.password))) {
		throw CustomError.Unauthorized('Incorrect phone number or password');
	}

	// Generate token
	const token = generateToken(user.id);

	return { user, token };
};

/**
 * Change user password
 */
export const changePassword = async (
	userId: string,
	currentPassword: string,
	newPassword: string
): Promise<User> => {
	// Find the user
	const user = await findUserById(userId);

	if (!user) {
		throw CustomError.NotFound('User not found');
	}

	// Verify the current password
	if (!(await comparePassword(currentPassword, user.password))) {
		throw CustomError.Unauthorized('Current password is incorrect');
	}

	// Hash the new password
	const hashedPassword = await hashPassword(newPassword);

	// Update the password
	const updated = await db
		.update(usersTable)
		.set({
			password: hashedPassword,
			updatedAt: new Date(),
		})
		.where(eq(usersTable.id, userId))
		.returning();

	if (!updated || updated.length === 0) {
		throw CustomError.InternalServerError('Failed to update password');
	}

	return updated[0];
};

/**
 * Find a verification code by phone number
 */
export const findVerificationByPhoneNumber = async (
	phoneNumber: string
): Promise<VerificationPool | undefined> => {
	const verification = (
		await db
			.select()
			.from(verificationPoolTable)
			.where(
				and(
					eq(verificationPoolTable.phoneNumber, phoneNumber),
					inArray(verificationPoolTable.verificationStatus, ['pending', 'sent'])
				)
			)
	)[0];

	return verification;
};

/**
 * Generate a verification code
 */
export const generateVerificationCode = (): string => {
	return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create a verification entry
 */
export const createVerification = async (
	phoneNumber: string,
	code: string
): Promise<string> => {
	const insertedVerification = (
		await db
			.insert(verificationPoolTable)
			.values({
				phoneNumber,
				verificationCode: code,
				verificationStatus: 'pending',
				verificationAttempts: 0,
				verificationSentAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning({ id: verificationPoolTable.id })
	)[0];

	return insertedVerification.id;
};

/**
 * Update a verification entry
 */
export const updateVerification = async (
	existingVerificationId: string,
	newCode: string
): Promise<string> => {
	const updatedVerification = (
		await db
			.update(verificationPoolTable)
			.set({
				messageId: null,
				verificationCode: newCode,
				verificationStatus: 'pending',
				updatedAt: new Date(),
			})
			.where(eq(verificationPoolTable.id, existingVerificationId))
			.returning({ id: verificationPoolTable.id })
	)[0];

	return updatedVerification.id;
};

/**
 * Update a verification attempts
 */
export const updateVerificationAttempts = async (
	verificationId: string,
	attempts: number
): Promise<void> => {
	await db
		.update(verificationPoolTable)
		.set({
			verificationAttempts: attempts + 1,
			updatedAt: new Date(),
		})
		.where(eq(verificationPoolTable.id, verificationId));
};

/**
 * Update a verification status
 */
export const updateVerificationStatus = async (
	verificationId: string,
	status: 'pending' | 'sent' | 'verified' | 'failed'
): Promise<void> => {
	await db
		.update(verificationPoolTable)
		.set({
			verificationStatus: status,
			updatedAt: new Date(),
		})
		.where(eq(verificationPoolTable.id, verificationId));
};

/**
 * Send a verification code email
 */
export const sendVerificationCodeSMS = async (
	phoneNumber: string,
	code: string,
	verificationId: string
): Promise<void> => {
	const message = `Your verification code is ${code}`;
	const smsResult = await sendMessage(phoneNumber, message);

	await db
		.update(verificationPoolTable)
		.set({
			messageId: smsResult.messageId,
			verificationStatus: 'sent',
			verificationSentAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(verificationPoolTable.id, verificationId));
};
