import { z } from 'zod';
import { emailSchema, nameSchema, passwordSchema, phoneSchema } from './base';

// Send Verification OTP Schema
export const sendVerificationOTPSchema = z.object({
	phoneNumber: phoneSchema,
});

// User Verification Schema
export const registerSchema = z.object({
	firstName: nameSchema,
	lastName: nameSchema,
	email: emailSchema,
	password: passwordSchema,
	phoneNumber: phoneSchema,
	verificationCode: z.string().length(6),
});

// Login Schema
export const loginSchema = z.object({
	phoneNumber: phoneSchema,
	password: z.string(),
});

// Change Password Schema
export const changePasswordSchema = z
	.object({
		currentPassword: z.string(),
		newPassword: passwordSchema,
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	});

// Infer types from schemas for use in controllers
export type SendVerificationOTPInput = z.infer<
	typeof sendVerificationOTPSchema
>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
