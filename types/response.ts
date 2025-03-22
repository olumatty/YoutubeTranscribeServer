import { Response, Request } from 'express';

interface PaginationMeta {
	total: number;
	page: number;
	limit: number;
	hasMore: boolean;
}

// New interfaces for the request handler
export interface ResponseBody<T = any> {
	status?: 'success';
	statusCode?: number;
	data: T;
	message?: string;
	pagination?: PaginationMeta;
}

// Extended request type with generic parameters
export interface CustomRequest<
	Params = { [key: string]: string },
	ReqBody = any,
	ReqQuery = { [key: string]: string }
> extends Request<Params, any, ReqBody, ReqQuery> {}

// Extended response type with generic data type
export interface CustomResponse<T = any> extends Response {
	json: (body: ResponseBody<T>) => this;
}
