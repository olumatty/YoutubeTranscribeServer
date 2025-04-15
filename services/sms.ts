import { env } from '../config/env';
import CustomError from '../utils/customError';

interface SMSMessageData {
	SMSMessageData: {
		Message: string;
		Recipients: {
			cost: string;
			messageId: string;
			number: string;
			status: string;
			statusCode: string;
		}[];
	};
}

export async function sendMessage(phoneNumber: string, message: string) {
	const response = await fetch(
		'https://api.sandbox.africastalking.com/version1/messaging',
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				apikey: env.AT_API_KEY,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				username: env.AT_USERNAME,
				to: phoneNumber,
				message,
				from: 'P-BETA',
			}),
		}
	);

	if (!response.ok) {
		throw CustomError.ThirdPartyServiceError('Failed to send message');
	}

	const result = (await response.json()) as SMSMessageData;

	return result.SMSMessageData.Recipients[0];
}
