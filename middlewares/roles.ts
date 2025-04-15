import { Request, Response, NextFunction } from 'express';
import CustomError from '../utils/customError';

/**
 * Middleware to validate if a user has admin role
 */
export const validateAdmin = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const user = req.user;

	if (!user) {
		throw CustomError.Unauthorized('Authentication required');
	}

	if (user.role !== 'admin') {
		throw CustomError.Forbidden('Admin access required');
	}

	next();
};

/**
 * Middleware to validate if a user has agent role or higher
 */
export const validateAgent = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const user = req.user;

	if (!user) {
		throw CustomError.Unauthorized('Authentication required');
	}

	if (!['admin', 'agent'].includes(user.role || '')) {
		throw CustomError.Forbidden('Agent or admin access required');
	}

	next();
};
