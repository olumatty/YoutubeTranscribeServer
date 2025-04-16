import { randomUUID } from 'crypto';
import { VerificationPool } from '../../db/schema';

export const createMockVerification = (): VerificationPool => {
	const now = new Date();
	return {
		id: randomUUID(),
		phoneNumber: '+1234567890',
		verificationCode: '123456',
		verificationStatus: 'pending' as const,
		verificationAttempts: 0,
		verificationSentAt: now,
		messageId: null,
		createdAt: now,
		updatedAt: now,
	};
};

export const createMockNewVerification = (): VerificationPool => {
	const now = new Date();
	return {
		id: randomUUID(),
		phoneNumber: '+2345678901',
		verificationCode: '234561',
		verificationStatus: 'pending' as const,
		verificationAttempts: 0,
		verificationSentAt: now,
		messageId: null,
		createdAt: now,
		updatedAt: now,
	};
};
