import { Request, Response, NextFunction } from 'express';
import { verifyToken, findUserById } from '../services/auth';
import CustomError from '../utils/customError';

/**
 * Authentication middleware to protect routes
 * Verifies the JWT token and attaches the user to the request object
 */
export const authenticate = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		let token: string | undefined;

		// Get token from Authorization header
		const authHeader = req.headers.authorization;
		if (authHeader && authHeader.startsWith('Bearer ')) {
			token = authHeader.split(' ')[1];
		}

		// If no token in header, check cookies
		if (!token && req.cookies.jwt) {
			token = req.cookies.jwt;
		}

		if (!token) {
			throw CustomError.Unauthorized('Authentication required. Please log in.');
		}

		// Verify the token
		const decoded = verifyToken(token);

		// Get the user from the database
		const user = await findUserById(decoded.id);

		if (!user) {
			throw CustomError.Unauthorized('User not found');
		}

		// Attach user to request object
		req.user = user;

		next();
	} catch (error) {
		next(error);
	}
};

/**
 * Optional authentication middleware
 * Attempts to authenticate the user, but does not fail if no token is provided
 */
export const optionalAuthenticate = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		let token: string | undefined;

		// Get token from Authorization header
		const authHeader = req.headers.authorization;
		if (authHeader && authHeader.startsWith('Bearer ')) {
			token = authHeader.split(' ')[1];
		}

		// If no token in header, check cookies
		if (!token && req.cookies.jwt) {
			token = req.cookies.jwt;
		}

		// If no token found, continue without authentication
		if (!token) {
			return next();
		}

		// Verify the token
		const decoded = verifyToken(token);

		// Get the user from the database
		const user = await findUserById(decoded.id);

		if (user) {
			// Attach user to request object
			req.user = user;
		}

		next();
	} catch (error) {
		// Don't throw errors for optional authentication
		next();
	}
};
