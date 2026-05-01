import { YoutubeTranscript } from "youtube-transcript";
import { TranscriptionResponse, TranscriptSegment } from "../types/transcription";

function extractVideoId(input: string): string {
	const trimmed = input.trim();
	const patterns = [
		/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
		/^([a-zA-Z0-9_-]{11})$/,
	];

	for (const pattern of patterns) {
		const match = trimmed.match(pattern);
		if (match) {
			return match[1];
		}
	}

	throw new Error("Invalid YouTube URL or video ID");
}

export default async function transcribeYoutubeVideo(
	videoUrl: string
): Promise<TranscriptionResponse> {
	try {
		console.log(`[INFO] Starting transcription for: ${videoUrl}`);
		const videoId = extractVideoId(videoUrl);
		console.log(`[INFO] Extracted video ID: ${videoId}`);

		const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);

		if (!transcriptData || transcriptData.length === 0) {
			throw new Error("No transcript available for this video");
		}

		const segments: TranscriptSegment[] = transcriptData.map((item) => ({
			text: item.text,
			offset: item.offset,
			duration: item.duration,
		}));

		const transcriptionText = segments
			.map((segment) => segment.text)
			.join(" ")
			.trim();

		return {
			success: true,
			videoId,
			transcription: transcriptionText,
			segments,
		};
	} catch (error) {
		console.error("[ERROR] Transcription failed:", error);

		const message = error instanceof Error ? error.message : "Unknown error";
		if (message.includes("Transcript is disabled")) {
			return { success: false, error: "Transcripts are disabled for this video" };
		}
		if (message.includes("No transcript")) {
			return { success: false, error: "No transcript available for this video" };
		}

		return { success: false, error: `Transcription failed: ${message}` };
	}
}
