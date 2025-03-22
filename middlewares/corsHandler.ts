import { Request, Response } from 'express';
import requestHandler from '../utils/requestHandler';

// CORS middleware function
const corsHandler = requestHandler(async (req: Request, res: Response) => {
	const allowedOrigins = [
		...(process.env.ALLOWED_ORIGINS || '').split(','),
	].filter(Boolean);
	const origin = req.headers.origin;

	if (origin && allowedOrigins.includes(origin)) {
		res.header('Access-Control-Allow-Origin', origin); // Allow the specific origin
	}

	res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

	res.header(
		'Access-Control-Allow-Headers',
		'Origin, X-Requested-With, Content-Type, Accept, Authorization'
	);

	res.header('Access-Control-Allow-Credentials', 'true');

	// Handle preflight requests
	if (req.method === 'OPTIONS') {
		res.sendStatus(200);
	}

	return { data: null };
}, 'middleware');

export default corsHandler;
