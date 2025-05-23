import { Request, Response } from "express";
import requestHandler from "../utils/requestHandler";
import { env } from "../config/env";

// CORS middleware function
const corsHandler = requestHandler(async (req: Request, res: Response) => {
	const allowedOrigins = env.ALLOWED_ORIGINS;
	const origin = req.headers.origin;

	if (origin && allowedOrigins.includes(origin)) {
		res.header("Access-Control-Allow-Origin", origin); // Allow the specific origin
	}

	res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

	res.header(
		"Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept, Authorization"
	);

	res.header("Access-Control-Allow-Credentials", "true");

	// Handle preflight requests
	if (req.method === "OPTIONS") {
		res.sendStatus(200);
		return { data: null };
	}

	return { data: null };
}, "middleware");

export default corsHandler;
