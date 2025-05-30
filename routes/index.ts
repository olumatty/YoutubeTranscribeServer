// routes/index.ts
import express, { RequestHandler, Request, Response } from "express";
import transcribeYoutubeVideo from "../utils/TranscribeYoutubeVideos";
import { oauth2Client, TOKEN_PATH } from "./auth";
import fs from "fs/promises";

const transcriptionRouter = express.Router();
const oauthRouter = express.Router();

console.log("[INFO] Registering routes at", new Date().toISOString());

interface TranscriptionRequest {
	youtubeUrl: string;
}

const transcribeHandler: RequestHandler = async (req, res) => {
	console.log("[INFO] Handling request:", req.method, req.originalUrl);
	const youtubeUrl = req.body.youtubeUrl || req.query.url;

	if (!youtubeUrl || typeof youtubeUrl !== "string") {
		console.error("[ERROR] YouTube URL is required");
		res.status(400).json({ success: false, error: "YouTube URL is required" });
		return;
	}

	try {
		const result = await transcribeYoutubeVideo(youtubeUrl);
		if (result.error) {
			console.error(`[ERROR] Transcription error: ${result.error}`);
			res.status(500).json({ success: false, error: result.error });
			return;
		}
		console.log(`[INFO] Transcription successful for ${youtubeUrl}`);
		res.json({
			transcription: result.transcription,
			success: true,
		});
	} catch (error) {
		console.error(
			`[CRITICAL ERROR] Transcription failed for ${youtubeUrl}:`,
			error instanceof Error ? error.stack : String(error)
		);
		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

transcriptionRouter.get("/", transcribeHandler); // /api/transcribe
transcriptionRouter.post("/", transcribeHandler); // /api/transcribe

oauthRouter.get("/oauth2callback", async (req: Request, res: Response) => {
	console.log("[INFO] Handling /oauth2callback at", new Date().toISOString());
	const { code } = req.query;
	if (!code || typeof code !== "string") {
		console.error("[ERROR] No code provided");
		res.status(400).json({ success: false, error: "No code provided" });
		return;
	}
	try {
		const { tokens } = await oauth2Client.getToken(code);
		oauth2Client.setCredentials(tokens);
		await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
		console.log(`[INFO] Token saved to ${TOKEN_PATH}`);
		res.send("Authentication successful! You can close this window.");
	} catch (error) {
		console.error("[ERROR] Error getting token:", error);
		res.status(500).json({ success: false, error: "Error getting token" });
	}
});

// Catch-all for transcription routes
transcriptionRouter.all("*", (req, res) => {
	console.error(`[ERROR] Route not found: ${req.method} ${req.originalUrl}`);
	res.status(404).json({
		status: "error",
		message: `Route not found: ${req.method} ${req.originalUrl}`,
		code: 404,
	});
});

export { transcriptionRouter, oauthRouter };
export default transcriptionRouter;
