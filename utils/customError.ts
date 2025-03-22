import { HttpStatusCode, HTTP_STATUS_CODES } from '../types/error';

class CustomError extends Error {
	public readonly code: HttpStatusCode;
	public readonly details?: any;

	/**
	 * Creates a custom error object with enhanced error handling capabilities.
	 *
	 * @param {string} message - Error message
	 * @param {HttpStatusCode} code - HTTP status code of the error
	 * @param {any} details - Additional error details (only shown in development)
	 */
	constructor(
		message: string,
		code: HttpStatusCode = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
		details?: any
	) {
		super(message);
		this.name = this.constructor.name;
		this.code = this.normalizeErrorCode(code);
		this.details = details;

		// Maintains proper stack trace for where our error was thrown
		Error.captureStackTrace(this, this.constructor);
	}

	/**
	 * Ensures the error code is a valid HTTP status code, defaults to 500 if invalid
	 */
	private normalizeErrorCode(code: HttpStatusCode): HttpStatusCode {
		return Object.values(HTTP_STATUS_CODES).includes(code)
			? code
			: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
	}

	/**
	 * Creates a 400 Bad Request error
	 */
	static BadRequest(message: string, details?: any) {
		return new CustomError(message, HTTP_STATUS_CODES.BAD_REQUEST, details);
	}

	/**
	 * Creates a 401 Unauthorized error
	 */
	static Unauthorized(message: string, details?: any) {
		return new CustomError(message, HTTP_STATUS_CODES.UNAUTHORIZED, details);
	}

	/**
	 * Creates a 403 Forbidden error
	 */
	static Forbidden(message: string, details?: any) {
		return new CustomError(message, HTTP_STATUS_CODES.FORBIDDEN, details);
	}

	/**
	 * Creates a 404 Not Found error
	 */
	static NotFound(message: string, details?: any) {
		return new CustomError(message, HTTP_STATUS_CODES.NOT_FOUND, details);
	}

	/**
	 * Creates a 409 Conflict error
	 */
	static Conflict(message: string, details?: any) {
		return new CustomError(message, HTTP_STATUS_CODES.CONFLICT, details);
	}

	/**
	 * Creates a 422 Unprocessable Entity error
	 */
	static UnprocessableEntity(message: string, details?: any) {
		return new CustomError(
			message,
			HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY,
			details
		);
	}

	/**
	 * Creates a 500 Internal Server Error
	 */
	static InternalServerError(message: string, details?: any) {
		return new CustomError(
			message,
			HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
			details
		);
	}
}

export default CustomError;
