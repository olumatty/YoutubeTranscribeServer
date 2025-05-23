import "./types";

// Load Environmental Variables
import "./helpers/setupEnv";
import { env } from "./config/env";

// Middleware imports
import corsHandler from "./middlewares/corsHandler";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import express from "express";
import cookieParser from "cookie-parser";
import transcriptionRouter from "./routes/index";

const app = express();

// Middlewares
app.use(corsHandler);
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/transcribe", transcriptionRouter);

app.get("/health", (_req, res) => {
	res.status(200).json({
		status: "OK",
		timestamp: new Date().toISOString(),
		allowedOrigins: env.ALLOWED_ORIGINS,
	});
});

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// connection
app.listen(env.PORT, () =>
	console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`)
);
