import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodArray, ZodEffects, ZodError } from 'zod';
import CustomError from '../utils/customError';

interface TransformedData {
	[x: string]: any;
}

/**
 * Middleware to validate request data against a Zod schema
 *
 * @param schema The Zod schema to validate against
 * @param source Where to look for data to validate (body, query, params)
 */
export const validate = (
	schema:
		| AnyZodObject
		| ZodArray<AnyZodObject>
		| ZodEffects<AnyZodObject>
		| ZodArray<ZodEffects<AnyZodObject>>,
	source: 'body' | 'query' | 'params' | 'file' | 'files' = 'body'
) => {
	return async (
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> => {
		try {
			let data: TransformedData | TransformedData[];

			// Validate and transform the data against the schema
			if (source === 'file') {
				await schema.parseAsync(req[source]);
				data = req[source] as TransformedData;
			} else if (source === 'files') {
				data = await Promise.all(
					(schema as unknown as Array<AnyZodObject>).map(async (s) => {
						await s.parseAsync(req[source]);
						return req[source];
					})
				);
			} else {
				data = await schema.parseAsync(req[source]);
			}

			// Replace the request data with the validated and transformed data
			req[source] = data;

			next();
		} catch (error) {
			if (error instanceof ZodError) {
				// Format Zod validation errors
				const formattedErrors = error.errors.reduce((acc, err) => {
					const path = err.path.join('.');
					acc[path] = err.message;
					return acc;
				}, {} as Record<string, string>);

				next(
					CustomError.UnprocessableEntity('Validation error', formattedErrors)
				);
			} else {
				next(error);
			}
		}
	};
};
