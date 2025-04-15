/**
 * Generates a random 6-digit OTP code.
 *
 * @returns {string} - A 6-digit OTP code as a string.
 */
export function generateOTP(): string {
	const otp = Math.floor(100000 + Math.random() * 900000);
	return otp.toString();
}
