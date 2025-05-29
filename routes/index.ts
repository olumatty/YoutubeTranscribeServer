import express, { RequestHandler, Request, Response } from "express";
import transcribeYoutubeVideo from "../utils/TranscribeYoutubeVideos";
import { oauth2Client, TOKEN_PATH } from "../routes/auth";
import fs from "fs";

const router = express.Router();

interface TranscriptionRequest {
	youtubeUrl: string;
}

const transcribeHandler: RequestHandler<{}, any, TranscriptionRequest> = async (
	req,
	res
) => {
	const { youtubeUrl } = req.body;

	if (!youtubeUrl) {
		res.status(400).json({ success: false, error: "YouTube URL is required" });
		return;
	}

	try {
		const result = await transcribeYoutubeVideo(youtubeUrl);
		if (result.error) {
			res.status(500).json({ error: result.error });
			return;
		}

		res.json({
			transcription: result.transcription,
			success: true,
		});
	} catch (error) {
		console.error(
			`[CRITICAL ERROR] Transcription failed for ${youtubeUrl}:`,
			error instanceof Error ? error.stack : String(error)
		);
	}
};

router.post("/", transcribeHandler);

router.get("/oauth2callback", async (req: Request, res: Response) => {
	const { code } = req.query;
	if (!code || typeof code !== "string") {
		console.log("No code provided");
		res.status(400).json({ success: false, error: "No code provided" });
		return;
	}
	try {
		const { tokens } = await oauth2Client.getToken(code);
		oauth2Client.setCredentials(tokens);
		fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
		console.log("Token received");
		res.status(200).json({ success: true, tokens });
	} catch (error) {
		console.error("Error getting token:", error);
		res.status(500).json({ success: false, error: "Error getting token" });
	}
});

export default router;
