import CustomError from '../utils/customError';
import requestHandler from '../utils/requestHandler';
import {
	createUser,
	loginUser,
	findUserByPhoneNumber,
	changePassword as changeUserPassword,
	generateVerificationCode,
	sendVerificationCodeSMS,
	findVerificationByPhoneNumber,
	createVerification,
	updateVerification,
	updateVerificationAttempts,
	updateVerificationStatus,
} from '../services/auth';
import {
	SendVerificationOTPInput,
	RegisterInput,
	LoginInput,
	ChangePasswordInput,
} from '../schemas/auth';
import { env } from '../config/env';

/**
 * Send a verification code to a user's phone number
 */
export const sendVerificationOTP = requestHandler(async (req) => {
	const { phoneNumber }: SendVerificationOTPInput = req.body;

	// Check if user with user already exists
	const existingUser = await findUserByPhoneNumber(phoneNumber);
	if (existingUser) {
		throw CustomError.Conflict('User with this phone number already exists.');
	}

	// Get existing verification
	const existingVerification = await findVerificationByPhoneNumber(phoneNumber);

	if (existingVerification) {
		// BANNED: If the user has made too many attempts, return an error
		if (existingVerification.verificationAttempts >= 5) {
			throw CustomError.Forbidden(
				'Too many verification attempts. Try again later.'
			);
		}

		// If the verification code has been sent in the last 5 minutes, return an error
		if (
			existingVerification.verificationSentAt >
			new Date(Date.now() - 5 * 60 * 1000)
		) {
			throw CustomError.Forbidden(
				'Please wait 5 minutes before requesting a new verification code.'
			);
		}
	}

	// Generate verification code
	const verificationCode = generateVerificationCode();
	let verificationId: string;

	if (existingVerification) {
		// Update verification code in database
		verificationId = await updateVerification(
			existingVerification.id,
			verificationCode
		);
	} else {
		// Create verification code in database
		verificationId = await createVerification(phoneNumber, verificationCode);
	}

	// Send verification code to user
	await sendVerificationCodeSMS(phoneNumber, verificationCode, verificationId);

	return {
		data: null,
		message: 'Verification code sent successfully',
	};
});

/**
 * Verify a user's phone number
 */
export const register = requestHandler(async (req, res) => {
	const {
		email,
		firstName,
		lastName,
		password,
		phoneNumber,
		verificationCode,
	}: RegisterInput = req.body;

	// Check if user with phone number already exists
	const existingUser = await findUserByPhoneNumber(phoneNumber);
	if (existingUser) {
		throw CustomError.Conflict('User with this phone number already exists.');
	}

	// Get verification entry
	const verification = await findVerificationByPhoneNumber(phoneNumber);

	// If the verification code is not found, return an error
	if (!verification) {
		throw CustomError.NotFound(
			'No verification code sent for this phone number. Please request a new verification code.'
		);
	}

	// Update verification attempts
	await updateVerificationAttempts(
		verification.id,
		verification.verificationAttempts
	);

	// BANNED: If user has made too many attempts, return an error
	if (verification.verificationAttempts >= 5) {
		throw CustomError.Forbidden(
			'Too many verification attempts. Try again later.'
		);
	}

	// Check if verification code is correct
	if (verification.verificationCode !== verificationCode) {
		throw CustomError.Forbidden('Invalid verification code.');
	}

	// Check if verification code is expired (codes expire after 15 minutes)
	if (verification.verificationSentAt < new Date(Date.now() - 15 * 60 * 1000)) {
		throw CustomError.Forbidden('Verification code expired.');
	}

	// Update verification status and attempts
	await updateVerificationStatus(verification.id, 'verified');

	// Create the user
	await createUser({
		email,
		firstName,
		lastName,
		password,
		phoneNumber,
		isPhoneVerified: true,
	});

	// Attempt to login
	const { user: loggedInUser, token } = await loginUser(phoneNumber, password);

	// Remove sensitive data before sending response
	const { password: _password, ...userWithoutPassword } = loggedInUser;

	// Set JWT cookie
	res.cookie('jwt', token, {
		httpOnly: true,
		secure: env.isProduction(),
		sameSite: 'strict',
		maxAge:
			parseInt(env.JWT_COOKIE_EXPIRES_IN.toString()) * 24 * 60 * 60 * 1000, // days to ms
	});

	return {
		data: {
			user: userWithoutPassword,
			token,
		},
		message: 'Phone number verified and logged in successfully',
	};
});

/**
 * Login a user
 */
export const login = requestHandler(async (req, res) => {
	const { phoneNumber, password }: LoginInput = req.body;

	// Attempt to login
	const { user, token } = await loginUser(phoneNumber, password);

	// Remove sensitive data before sending response
	const { password: userPassword, ...userWithoutPassword } = user;

	// Set JWT cookie
	res.cookie('jwt', token, {
		httpOnly: true,
		secure: env.isProduction(),
		sameSite: 'strict',
		maxAge:
			parseInt(env.JWT_COOKIE_EXPIRES_IN.toString()) * 24 * 60 * 60 * 1000, // days to ms
	});

	return {
		data: {
			user: userWithoutPassword,
			token,
		},
		message: 'Logged in successfully',
	};
});

/**
 * Change the user's password
 */
export const changePassword = requestHandler(async (req) => {
	const user = req.user;
	const { currentPassword, newPassword }: ChangePasswordInput = req.body;

	if (!user) {
		throw CustomError.Unauthorized('Not authenticated');
	}

	// Change the password
	await changeUserPassword(user.id, currentPassword, newPassword);

	return {
		data: null,
		message: 'Password changed successfully',
	};
});

/**
 * Logout a user
 */
export const logout = requestHandler(async (_req, res) => {
	// Clear the JWT cookie
	res.cookie('jwt', '', {
		httpOnly: true,
		expires: new Date(0), // Expire immediately
		secure: env.isProduction(),
		sameSite: 'strict',
	});

	return {
		data: null,
		message: 'Logged out successfully',
	};
});
