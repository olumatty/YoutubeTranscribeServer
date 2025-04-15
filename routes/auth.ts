import express from 'express';

import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
	login,
	logout,
	changePassword,
	sendVerificationOTP,
	register,
} from '../controllers/auth';
import {
	loginSchema,
	changePasswordSchema,
	sendVerificationOTPSchema,
	registerSchema,
} from '../schemas/auth';

const router = express.Router();

// Public routes
router.post(
	'/send-verification-otp',
	validate(sendVerificationOTPSchema),
	sendVerificationOTP
);
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);

// Protected routes
router.post(
	'/change-password',
	authenticate,
	validate(changePasswordSchema),
	changePassword
);

export default router;
