import { z } from 'zod';
import { nameSchema, phoneSchema, sanitizeString } from './base';

// Update Profile Schema
export const updateProfileSchema = z
	.object({
		firstName: nameSchema.optional(),
		lastName: nameSchema.optional(),
		phoneNumber: phoneSchema.optional(),
		address: z
			.string()
			.optional()
			.transform((val) => (val ? sanitizeString(val) : val)),
		city: z
			.string()
			.optional()
			.transform((val) => (val ? sanitizeString(val) : val)),
		state: z
			.string()
			.optional()
			.transform((val) => (val ? sanitizeString(val) : val)),
		country: z
			.string()
			.optional()
			.transform((val) => (val ? sanitizeString(val) : val)),
		postalCode: z
			.string()
			.optional()
			.transform((val) => (val ? sanitizeString(val) : val)),
		profilePictureUrl: z
			.string()
			.url('Profile picture URL must be a valid URL')
			.optional()
			.transform((val) => (val ? sanitizeString(val) : val)),
	})
	.refine(
		(data) => {
			// Ensure at least one field is provided
			return Object.keys(data).length > 0;
		},
		{
			message: 'At least one field must be provided for update',
		}
	);

// Infer types from schemas for use in controllers
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
