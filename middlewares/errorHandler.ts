import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import CustomError from '../utils/customError';
import { ErrorResponse, HTTP_STATUS_CODES } from '../types/error';
import { sanitizeErrorMessage } from '../utils/sanitizeErrorMessage';
import requestHandler from '../utils/requestHandler';

/**
 * Global error handling middleware
 */
export const errorHandler = (
	err: Error,
	req: Request,
	res: Response,
	_next: NextFunction
): void => {
	// Determine the appropriate status code
	const statusCode =
		err instanceof CustomError
			? err.code
			: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;

	logger.error(`[${req.method}] ${req.path} - Error:`, {
		message: err.message,
		stack: err.stack,
		code: statusCode,
		details: err instanceof CustomError ? err.details : undefined,
	});

	const isCustomError = err instanceof CustomError;
	const response: ErrorResponse = {
		status: 'error',
		message: sanitizeErrorMessage(err.message),
		code: isCustomError ? err.code : statusCode,
	};

	if (process.env.NODE_ENV !== 'production') {
		response.message = err.message;
		response.details = isCustomError
			? err.details
			: {
					stack: err.stack,
					name: err.name,
			  };
	}

	// Send error response
	res.status(statusCode).json(response);
};

/**
 * Middleware to handle 404 Not Found errors
 */
export const notFoundHandler = requestHandler(async (req: Request) => {
	throw CustomError.NotFound(`Route not found: ${req.method} ${req.path}`);
}, 'middleware');
