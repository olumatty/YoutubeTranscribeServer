import { NextFunction, RequestHandler } from 'express';
import { ResponseBody, CustomRequest, CustomResponse } from '../types/response';

type HandlerType =
	| 'json'
	| 'middleware'
	| 'stream'
	| 'send'
	| 'download'
	| 'file'
	| 'sse'
	| 'redirect';

interface FileResponse {
	path: string;
	filename?: string;
}

interface SSEResponse {
	event: string;
	data: any;
}

interface RedirectResponse {
	url: string;
	statusCode?: number;
}

/**
 * Wraps route handlers to standardize response formatting and error handling
 *
 * @param handler The async route handler function
 * @param type The type of response handling required
 * @returns An express route handler with standardized response formatting
 *
 * @example
 * // Basic JSON response
 * router.get('/users', requestHandler(async (req) => {
 *   const users = await getUsers();
 *   return { data: users };
 * }));
 *
 * // File download
 * router.get('/download', requestHandler(async () => {
 *   return {
 *     data: { path: './files/doc.pdf', filename: 'document.pdf' },
 *     type: 'download'
 *   };
 * }));
 *
 * // SSE Stream
 * router.get('/events', requestHandler(async () => {
 *   return {
 *     data: { event: 'update', data: { status: 'processing' } },
 *     type: 'sse'
 *   };
 * }));
 *
 * // Redirect
 * router.get('/old-path', requestHandler(async () => {
 *   return {
 *     data: { url: '/new-path', statusCode: 301 },
 *     type: 'redirect'
 *   };
 * }));
 */
export default function requestHandler<
	T,
	Params = { [key: string]: string },
	ReqBody = any,
	ReqQuery = { [key: string]: string }
>(
	handler: (
		req: CustomRequest<Params, ReqBody, ReqQuery>,
		res: CustomResponse<T>,
		next: NextFunction
	) => Promise<ResponseBody<T>>,
	type: HandlerType = 'json'
): RequestHandler<Params, any, ReqBody, ReqQuery> {
	return async (
		req: CustomRequest<Params, ReqBody, ReqQuery>,
		res: CustomResponse<T>,
		next: NextFunction
	): Promise<void> => {
		try {
			const result = await handler(req, res, next);
			const statusCode = result.statusCode || 200;

			// Format the response based on the type
			switch (type) {
				case 'middleware':
					res.status(statusCode);
					next();
					break;

				case 'stream':
					res.write('event: close\n');
					res.write('data: Connection closing\n\n');
					res.status(statusCode).end();
					break;

				case 'send':
					res.status(statusCode).send(result.data);
					break;

				case 'download':
					const downloadData = result.data as FileResponse;
					if (downloadData.filename) {
						res.download(downloadData.path, downloadData.filename);
					} else {
						res.download(downloadData.path);
					}
					break;

				case 'file':
					const fileData = result.data as FileResponse;
					if (fileData.filename) {
						res.attachment(fileData.filename);
					}
					res.sendFile(fileData.path);
					break;

				case 'sse':
					const sseData = result.data as SSEResponse;
					res.setHeader('Content-Type', 'text/event-stream');
					res.setHeader('Cache-Control', 'no-cache');
					res.setHeader('Connection', 'keep-alive');
					res.write(`event: ${sseData.event}\n`);
					res.write(`data: ${JSON.stringify(sseData.data)}\n\n`);
					break;

				case 'redirect':
					const redirectData = result.data as RedirectResponse;
					res.redirect(redirectData.statusCode || 302, redirectData.url);
					break;

				case 'json':
				default:
					// Transform to standardized response format
					const response = {
						status: 'success' as const,
						statusCode,
						data: result.data,
						...(result.message && { message: result.message }),
						...(result.pagination && { pagination: result.pagination }),
					};
					res.status(statusCode).json(response);
					break;
			}
		} catch (error) {
			next(error);
		}
	};
}
