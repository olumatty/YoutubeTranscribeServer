import 'express';
import { User } from '../db/schema';

declare module 'express' {
	interface Request {
		user?: User;
	}
}
