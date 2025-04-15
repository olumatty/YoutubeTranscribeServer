import { z } from 'zod';
import validator from 'validator';

// Helper for sanitizing input strings
export const sanitizeString = (input: string): string => {
	return validator.escape(validator.trim(input));
};

// Common fields used in multiple schemas
export const emailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.email('Please provide a valid email address')
	.transform(sanitizeString);

export const nameSchema = z
	.string()
	.min(2, 'Name must be at least 2 characters')
	.max(100, 'Name cannot exceed 100 characters')
	.transform(sanitizeString);

export const passwordSchema = z
	.string()
	.min(8, 'Password must be at least 8 characters')
	.refine(
		(password) => {
			const hasUppercase = /[A-Z]/.test(password);
			const hasLowercase = /[a-z]/.test(password);
			const hasNumber = /\d/.test(password);
			const hasSpecialChar = /[@$!%*?&\.]/.test(password);
			return hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
		},
		{
			message:
				'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
		}
	);

export const phoneSchema = z
	.string()
	.refine(validator.isMobilePhone, {
		message: 'Please provide a valid phone number',
	})
	.transform(sanitizeString);

// Create a gender enum
export const genderEnum = z.enum(['male', 'female']);

// Create an ID document type enum
export const idDocumentTypeEnum = z.enum([
	'national_id',
	'passport',
	'driving_license',
	'voters_card',
]);

// Create a proof of address document type enum
export const proofOfAddressDocumentTypeEnum = z.enum([
	'utility_bill',
	'bank_statement',
	'rental_agreement',
	'lease_agreement',
	'residence_permit',
	'other',
]);

// Create a purpose of account enum
export const purposeOfAccountEnum = z.enum([
	'personal_spending',
	'savings',
	'business_operations',
	'investments',
	'remittances',
	'other',
]);

// BVN validation
export const bvnSchema = z
	.string()
	.length(11, 'BVN must be exactly 11 digits')
	.regex(/^\d+$/, 'BVN must contain only digits')
	.transform(sanitizeString);

// Document type enum for uploads
export const documentUploadTypeEnum = z.enum(
	['id_front', 'id_back', 'selfie'],
	{
		errorMap: () => ({
			message: 'Document type must be one of: id_front, id_back, selfie',
		}),
	}
);
