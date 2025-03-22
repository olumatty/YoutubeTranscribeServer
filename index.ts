// Load Environmental Variables
import './config/env';

// Middleware imports
import corsHandler from './middlewares/corsHandler';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

import express from 'express';
import users from './routes/users';

const app = express();

// Middlewares
app.use(corsHandler);
app.use(express.json());

// Routes
app.use('/users', users);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

// export single server start time instance
export const SERVER_START_TIME = Date.now();

// connection
const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Listening to port ${port}`));
