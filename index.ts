import './types';

// Load Environmental Variables
import './helpers/setupEnv';
import { env } from './config/env';

// Middleware imports
import corsHandler from './middlewares/corsHandler';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

import express from 'express';
import cookieParser from 'cookie-parser';
import routes from './routes';

const app = express();

// Middlewares
app.use(corsHandler);
app.use(express.json());
app.use(cookieParser()); // Add cookie parser for JWT token cookies

// Routes
app.use(routes);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// connection
app.listen(env.PORT, () =>
	console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`)
);
