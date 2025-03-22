/**
 * Sanitizes error messages in production to avoid leaking sensitive information
 */
export const sanitizeErrorMessage = (message: string): string => {
	// Replace detailed database errors, stack traces, paths, etc.
	return (
		message.replace(/(?:(?:Error:|at)\s+.*?(?:\n|$))|(?:\/[\w/.:-]+)/g, '') ||
		'An unexpected error occurred'
	);
};
