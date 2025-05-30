// src/index.ts
import "./types";
import "./helpers/setupEnv";
import { env } from "./config/env";
import corsHandler from "./middlewares/corsHandler";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import express from "express";
import cookieParser from "cookie-parser";
import transcriptionRouter, { oauthRouter } from "./routes";

const app = express();

console.log("[INFO] Setting up Express app at", new Date().toISOString());

app.use(corsHandler);
app.use(express.json());
app.use(cookieParser());
app.set("trust proxy", true);

app.use("/api/transcribe", transcriptionRouter);
app.use("/", oauthRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () =>
	console.log(
		`[INFO] Server running on port ${env.PORT} in ${env.NODE_ENV} mode at`,
		new Date().toISOString()
	)
);
