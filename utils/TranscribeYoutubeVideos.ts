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
import { memoryUsage } from "process";
import { updateYouTubeCookies } from "./updateCookies";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const Output_Dir = path.join(__dirname, "temp_audio");

if (!fs.existsSync(Output_Dir)) {
	fs.mkdirSync(Output_Dir, { recursive: true });
	console.log(`[INFO] Created temporary audio directory: ${Output_Dir}`);
}

interface YouTubeMetadata {
	duration?: string | number;
	requested_formats?: Array<{ filesize?: number }>;
	[key: string]: any;
}

async function getVideoDuration(
	youtubeUrl: string,
	retries = 3,
	delay = 5000
): Promise<number> {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const info = (await youtubedl(youtubeUrl, {
				dumpSingleJson: true,
			})) as YouTubeMetadata;
			if (!info || typeof info !== "object" || !info.duration) {
				throw new Error("Invalid or missing metadata from YouTube");
			}
			const duration =
				typeof info.duration === "string" || typeof info.duration === "number"
					? parseFloat(info.duration.toString())
					: 0;
			if (isNaN(duration)) {
				throw new Error("Invalid duration received from YouTube metadata");
			}
			return duration;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			if (
				errorMsg.includes("429") ||
				errorMsg.includes("Sign in") ||
				errorMsg.includes("Login required")
			) {
				console.warn(
					`[WARN] Duration fetch attempt ${attempt} failed: ${errorMsg}`
				);
				if (attempt < retries) {
					console.log(`[INFO] Retrying after ${delay}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
					await updateYouTubeCookies();
				} else {
					throw new Error(
						`Failed to fetch video duration after ${retries} attempts: ${errorMsg}`
					);
				}
			} else {
				throw new Error(`Failed to fetch video duration: ${errorMsg}`);
			}
		}
	}
	throw new Error("Unexpected error in getVideoDuration");
}

async function downloadAudioWithYTDLP(
	youtubeUrl: string,
	outputPath: string,
	retries = 3,
	delay = 5000
): Promise<void> {
	console.log(`[INFO] Attempting to download audio to: ${outputPath}`);

	const cookiesPath = path.resolve(__dirname, "../cookies.txt");
	console.log(`[INFO] Cookies path: ${cookiesPath}`);

	let hasValidCookies = false;
	if (fs.existsSync(cookiesPath)) {
		const cookiesContent = fs.readFileSync(cookiesPath, "utf-8");
		hasValidCookies = cookiesContent
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

		if (!hasValidCookies) {
			console.warn(
				"[WARN] No valid cookies found in cookies.txt. Updating cookies..."
			);
			await updateYouTubeCookies();
			hasValidCookies = fs.existsSync(cookiesPath);
		}
	} else {
		console.warn("[WARN] Cookies file not found. Creating new cookies...");
		await updateYouTubeCookies();
		hasValidCookies = fs.existsSync(cookiesPath);
	}

	const MAX_FILE_SIZE_MB = 25;
	const downloadOptions = {
		extractAudio: true,
		audioFormat: "mp3",
		audioQuality: 9,
		output: path.resolve(outputPath),
		maxFilesize: `${MAX_FILE_SIZE_MB}m`,
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

	// Pre-download file size check
	try {
		const info = await youtubedl(youtubeUrl, { dumpSingleJson: true });
		if (
			typeof info === "object" &&
			info.requested_formats &&
			Array.isArray(info.requested_formats)
		) {
			const fileSizeMB = info.requested_formats[0]?.filesize
				? info.requested_formats[0].filesize / 1024 / 1024
				: 0;
			if (fileSizeMB > MAX_FILE_SIZE_MB) {
				throw new Error(
					`Estimated file size (${fileSizeMB.toFixed(
						2
					)} MB) exceeds ${MAX_FILE_SIZE_MB} MB limit`
				);
			}
		} else {
			console.warn(
				"[WARN] Unable to estimate file size: Invalid metadata format"
			);
		}
	} catch (error) {
		console.warn("[WARN] Failed to estimate file size:", error);
	}

	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			console.log("[INFO] Starting download with youtube-dl-exec");
			await youtubedl(youtubeUrl, downloadOptions);
			const stats = fs.statSync(outputPath);
			console.log(
				`[INFO] Downloaded file size: ${(stats.size / 1024 / 1024).toFixed(
					2
				)} MB`
			);
			if (stats.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
				fs.unlinkSync(outputPath);
				throw new Error(`Downloaded file exceeds ${MAX_FILE_SIZE_MB} MB limit`);
			}
			return;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			if (
				errorMsg.includes("429") ||
				errorMsg.includes("403") ||
				errorMsg.includes("Sign in") ||
				errorMsg.includes("Login required")
			) {
				console.warn(`[WARN] Download attempt ${attempt} failed: ${errorMsg}`);
				if (attempt < retries) {
					console.log(`[INFO] Retrying after ${delay}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
					await updateYouTubeCookies();
					downloadOptions.cookies = cookiesPath;
				} else {
					throw new Error(
						`Download failed after ${retries} attempts: ${errorMsg}`
					);
				}
			} else {
				throw error;
			}
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
			.audioFrequency(8000)
			.on("error", (err) => reject(new Error(`FFmpeg failed: ${err.message}`)))
			.pipe(stream);

		stream.on("data", (chunk) => chunks.push(chunk));
		stream.on("end", () => {
			const wavBuffer = Buffer.concat(chunks);
			console.log(
				`[INFO] WAV buffer size: ${(wavBuffer.length / 1024 / 1024).toFixed(
					2
				)} MB`
			);
			const wav = new WaveFile(wavBuffer);
			wav.toBitDepth("32f");
			wav.toSampleRate(8000);
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
			fs.promises.unlink(p).catch((err) => {
				if (err.code !== "ENOENT") {
					console.warn(`[WARN] Failed to delete ${p}: ${err.message}`);
				}
			})
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
		console.log("[INFO] Memory usage at start:", memoryUsage());

		const maxDuration = 180;
		const duration = await getVideoDuration(youtubeUrl);
		console.log(`[INFO] Video duration: ${duration}s`);
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
		console.log("[INFO] Memory usage after WAV conversion:", memoryUsage());

		const transcriber = await getTranscriber();
		console.log("[INFO] Starting transcription with Xenova/whisper-tiny.en");

		const chunkSize = 5 * 8000;
		const transcriptions: string[] = [];

		for (let i = 0; i < float32AudioData.length; i += chunkSize) {
			const chunk = float32AudioData.subarray(i, i + chunkSize);
			console.log(
				`[INFO] Transcribing chunk ${i / 8000}s to ${(i + chunkSize) / 8000}s`
			);
			console.log(
				"[INFO] Memory usage before chunk transcription:",
				memoryUsage()
			);
			const result = await transcriber(chunk, {
				chunk_length_s: 5,
				stride_length_s: 1,
				language: "english",
				task: "transcribe",
			});
			console.log(
				"[INFO] Memory usage after chunk transcription:",
				memoryUsage()
			);
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
		console.log("[INFO] Memory usage at end:", memoryUsage());

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
