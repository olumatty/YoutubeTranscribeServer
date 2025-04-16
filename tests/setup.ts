import { vi, beforeEach } from 'vitest';

// // Mock the database schema
// vi.mock('../db/schema', () => ({
// 	usersTable: {},
// 	verificationPoolTable: {},
// }));

// // Mock the SMS service
// vi.mock('../services/sms', () => ({
// 	sendMessage: vi.fn().mockResolvedValue(undefined),
// }));

// Reset all mocks before each test
beforeEach(() => {
	vi.clearAllMocks();
});
