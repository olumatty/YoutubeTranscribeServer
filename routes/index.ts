import express, { RequestHandler } from "express";
import transcribeYoutubeVideo from "../utils/TranscribeYoutubeVideos";

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
		res.status(400).json({ error: "YouTube URL is required" });
		return;
	}

	const result = await transcribeYoutubeVideo(youtubeUrl);
	if (result.error) {
		res.status(500).json({ error: result.error });
		return;
	}

	res.json({
		transcription: result.transcription,
		success: true,
	});
};

router.post("/", transcribeHandler);

export default router;
