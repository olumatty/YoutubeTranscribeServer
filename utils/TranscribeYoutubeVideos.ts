import youtubedl from "youtube-dl-exec";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { pipeline } from "@xenova/transformers";
import { v4 as uuidv4 } from "uuid";
import { TranscriptionResponse } from "../types/transcription";
import { WaveFile } from "wavefile";
import { PassThrough } from "stream";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const Output_Dir = path.join(__dirname, "temp_audio");

if (!fs.existsSync(Output_Dir)) {
	fs.mkdirSync(Output_Dir, { recursive: true });
	console.log(`[INFO] Created temporary audio directory: ${Output_Dir}`);
}

// Define interface for YouTube metadata
interface YouTubeMetadata {
	duration?: string | number;
	[key: string]: any;
}

async function getVideoDuration(youtubeUrl: string): Promise<number> {
	try {
		const info = (await youtubedl(youtubeUrl, {
			dumpSingleJson: true,
		})) as YouTubeMetadata;
		const duration = info.duration ? parseFloat(info.duration.toString()) : 0;
		if (isNaN(duration)) {
			throw new Error("Invalid duration received from YouTube metadata");
		}
		return duration;
	} catch (error) {
		throw new Error(
			`Failed to fetch video duration: ${
				error instanceof Error ? error.message : String(error)
			}`
		);
	}
}

async function downloadAudioWithYTDLP(
	youtubeUrl: string,
	outputPath: string
): Promise<void> {
	console.log(`[INFO] Attempting to download audio to: ${outputPath}`);

	const cookiesPath = path.resolve(__dirname, "../cookies.txt");
	console.log(`[INFO] Cookies path: ${cookiesPath}`);

	if (!fs.existsSync(cookiesPath)) {
		console.warn(
			"[WARN] Cookies file not found, attempting without cookies..."
		);
	}

	const cookiesContent = fs.existsSync(cookiesPath)
		? fs.readFileSync(cookiesPath, "utf-8")
		: "";
	const hasValidCookies =
		cookiesContent &&
		cookiesContent
			.split("\n")
			.filter((line) => !line.startsWith("#") && line.trim())
			.some((line) => {
				const parts = line.split("\t");
				if (parts.length < 7) return false;
				const [domain, , , , expires, name] = parts;
				const expiry = parseInt(expires, 10);
				const now = Math.floor(Date.now() / 1000);
				return (
					(domain.includes("youtube.com") || domain.includes("google.com")) &&
					[
						"SID",
						"__Secure-3PSID",
						"APISID",
						"SAPISID",
						"CONSENT",
						"SOCS",
					].includes(name) &&
					expiry > now
				);
			});

	if (!hasValidCookies && fs.existsSync(cookiesPath)) {
		console.warn(
			"[WARN] No valid cookies found in cookies.txt. Attempting without cookies..."
		);
	}

	const MAX_FILE_SIZE_MB = 25;
	const downloadOptions = {
		extractAudio: true,
		audioFormat: "mp3",
		output: path.resolve(outputPath),
		noCheckCertificates: true,
		referer: youtubeUrl,
		quiet: true,
		cookies: hasValidCookies ? cookiesPath : undefined,
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
		addHeader: ["accept-language: en-US,en;q=0.9"],
		sleepInterval: 10,
		retries: 5,
	};

	try {
		await youtubedl(youtubeUrl, downloadOptions);
		const stats = fs.statSync(outputPath);
		if (stats.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
			fs.unlinkSync(outputPath);
			throw new Error(`Downloaded file exceeds ${MAX_FILE_SIZE_MB} MB limit`);
		}
	} catch (error) {
		if (
			String(error).includes("403") ||
			String(error).includes("Login required")
		) {
			console.warn("[WARN] Trying without cookies for public video...");
			await youtubedl(youtubeUrl, { ...downloadOptions, cookies: undefined });
			const stats = fs.statSync(outputPath);
			if (stats.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
				fs.unlinkSync(outputPath);
				throw new Error(`Downloaded file exceeds ${MAX_FILE_SIZE_MB} MB limit`);
			}
		} else {
			throw error;
		}
	}
}

async function convertVideoToWavStream(
	inputPath: string
): Promise<Float32Array> {
	const stream = new PassThrough();
	const chunks: Buffer[] = [];

	return new Promise((resolve, reject) => {
		ffmpeg(inputPath)
			.audioCodec("pcm_s16le")
			.format("wav")
			.audioChannels(1)
			.audioFrequency(16000)
			.on("error", (err) => reject(new Error(`FFmpeg failed: ${err.message}`)))
			.pipe(stream);

		stream.on("data", (chunk) => chunks.push(chunk));
		stream.on("end", () => {
			const wavBuffer = Buffer.concat(chunks);
			const wav = new WaveFile(wavBuffer);
			wav.toBitDepth("32f");
			wav.toSampleRate(16000);
			const audioData = wav.getSamples();
			resolve(
				Array.isArray(audioData)
					? new Float32Array(audioData[0] as Float64Array)
					: new Float32Array(audioData as Float64Array)
			);
		});
		stream.on("error", reject);
	});
}

let transcriberInstance: any;

async function initializeTranscriber() {
	if (!transcriberInstance) {
		console.log("[INFO] Preloading ASR pipeline (Xenova/whisper-tiny.en)...");
		transcriberInstance = await pipeline(
			"automatic-speech-recognition",
			"Xenova/whisper-tiny.en"
		);
		console.log("[INFO] ASR pipeline preloaded.");
	}
}

// Preload transcriber at startup
initializeTranscriber().catch((err) =>
	console.error("[ERROR] Failed to preload transcriber:", err)
);

async function getTranscriber() {
	if (!transcriberInstance) {
		await initializeTranscriber();
	}
	return transcriberInstance;
}

async function cleanupFiles(...paths: string[]): Promise<void> {
	await Promise.all(
		paths.map((p) =>
			fs.promises
				.unlink(p)
				.catch((err) =>
					console.warn(`[WARN] Failed to delete ${p}: ${err.message}`)
				)
		)
	);
}

export default async function transcribeYoutubeVideo(
	youtubeUrl: string
): Promise<TranscriptionResponse> {
	const fileId = uuidv4();
	const rawAudioPath = path.join(Output_Dir, `${fileId}.mp3`);

	try {
		console.log(`\n--- Transcription Request for URL: ${youtubeUrl} ---`);

		// Check video duration
		const maxDuration = 120; // 2 minutes
		const duration = await getVideoDuration(youtubeUrl);
		if (duration > maxDuration) {
			return {
				transcription: "",
				error: `Video duration (${duration}s) exceeds limit (${maxDuration}s)`,
				success: false,
			};
		}

		await downloadAudioWithYTDLP(youtubeUrl, rawAudioPath);
		console.log(`[INFO] Downloaded audio to: ${rawAudioPath}`);

		console.log(`[INFO] Converting to WAV stream`);
		const float32AudioData = await convertVideoToWavStream(rawAudioPath);
		console.log("[INFO] Float32Array details:", {
			length: float32AudioData.length,
			first10: float32AudioData.slice(0, 10),
			last10: float32AudioData.slice(-10),
			isAllZeros: float32AudioData.every((val) => val === 0),
		});

		const transcriber = await getTranscriber();
		console.log("[INFO] Starting transcription with Xenova/whisper-tiny.en");

		const chunkSize = 10 * 16000; // 10 seconds at 16kHz
		const transcriptions: string[] = [];

		for (let i = 0; i < float32AudioData.length; i += chunkSize) {
			const chunk = float32AudioData.subarray(i, i + chunkSize);
			console.log(
				`[INFO] Transcribing chunk ${i / 16000}s to ${(i + chunkSize) / 16000}s`
			);
			const result = await transcriber(chunk, {
				chunk_length_s: 10,
				stride_length_s: 2,
				language: "english",
				task: "transcribe",
			});
			transcriptions.push(
				Array.isArray(result)
					? result.map((c) => c.text).join(" ")
					: result.text || ""
			);
		}

		await cleanupFiles(rawAudioPath);
		console.log("[INFO] Temporary files cleaned up");

		const transcriptionText = transcriptions.join(" ");
		console.log(`[INFO] Transcription length: ${transcriptionText.length}`);
		if (transcriptionText.length > 100) {
			console.log(
				`[INFO] Transcription snippet: "${transcriptionText.substring(
					0,
					100
				)}..."`
			);
		} else {
			console.log(`[INFO] Full transcription: "${transcriptionText}"`);
		}

		return {
			transcription: transcriptionText,
			error: "",
			success: true,
		};
	} catch (error) {
		await cleanupFiles(rawAudioPath);
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(
			`[CRITICAL ERROR] Transcription failed for ${youtubeUrl}:`,
			error instanceof Error ? error.stack : errorMessage
		);
		return {
			transcription: "",
			error: errorMessage,
			success: false,
		};
	}
}
