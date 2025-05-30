import express, { Response, Request, response } from "express";
import youtubedl from "youtube-dl-exec";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { pipeline } from "@xenova/transformers";
import { v4 as uuidv4 } from "uuid";
import { TranscriptionResponse } from "../types/transcription";
import { google } from "googleapis";
import { oauth2Client, TOKEN_PATH } from "../routes/auth";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const Output_Dir = path.join(__dirname, "temp_audio");

if (!fs.existsSync(Output_Dir)) {
	fs.mkdirSync(Output_Dir);
	console.log(`[INFO] Created temporary audio directory: ${Output_Dir}`);
}

async function loadOrRefreshToken(): Promise<void> {
	if (fs.existsSync(TOKEN_PATH)) {
		try {
			const tokenData = await fs.promises.readFile(TOKEN_PATH, "utf-8");
			const tokens = JSON.parse(tokenData);
			oauth2Client.setCredentials(tokens);
			console.log("[INFO] Token loaded from file");

			// Check if token is expired and refresh if needed
			if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
				console.log("[INFO] Token expired, refreshing...");
				try {
					const { credentials } = await oauth2Client.refreshAccessToken();
					oauth2Client.setCredentials(credentials);
					await fs.promises.writeFile(TOKEN_PATH, JSON.stringify(credentials));
					console.log("[INFO] Token refreshed and saved");
				} catch (refreshError) {
					console.error("[ERROR] Failed to refresh token:", refreshError);
					// Delete the invalid token file
					await fs.promises.unlink(TOKEN_PATH);
					throw new Error("Token refresh failed. Please re-authorize.");
				}
			}
		} catch (error) {
			console.error(
				"[ERROR] Failed to load token from file:",
				error instanceof Error ? error.message : String(error)
			);
			throw error;
		}
	} else {
		const authUrl = oauth2Client.generateAuthUrl({
			access_type: "offline",
			scope: ["https://www.googleapis.com/auth/youtube.readonly"],
		});
		console.log("[INFO] Please visit this URL to authorize:", authUrl);
		throw new Error(
			"Token file not found. Please authorize first by visiting the auth URL above, then try again."
		);
	}
}

async function verifyVideo(videoId: string): Promise<string> {
	console.log(`[INFO] Verifying video: ${videoId}`);
	const youtube = google.youtube({ version: "v3", auth: oauth2Client });
	try {
		const response = await youtube.videos.list({
			part: ["id", "snippet"],
			id: [videoId],
		});
		if (!response.data.items || response.data.items.length === 0) {
			throw new Error("Video not found or not accessible");
		}
		const title = response.data.items[0].snippet?.title || "Unknown title";
		console.log(`[INFO] Video verified: ${title}`);
		return title;
	} catch (error) {
		console.error("[ERROR] Video verification failed:", error);
		throw new Error(
			`Failed to verify video: ${
				error instanceof Error ? error.message : "Unknown error"
			}`
		);
	}
}

async function downloadAudioWithYTDLP(
	youtubeUrl: string,
	outputPath: string
): Promise<void> {
	console.log(`[INFO] Attempting to download audio to: ${outputPath}`);
	try {
		await youtubedl(youtubeUrl, {
			extractAudio: true,
			audioFormat: "mp3",
			output: outputPath,
			noCheckCertificates: true,
			quiet: true,
			userAgent:
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
			retries: 3,
			// Remove the Authorization header as it's not needed for youtube-dl
			addHeader: ["accept-language: en-US,en;q=0.9"],
		});

		// Verify the file was actually downloaded
		if (!fs.existsSync(outputPath)) {
			throw new Error(`Audio file was not created at ${outputPath}`);
		}

		const stats = fs.statSync(outputPath);
		if (stats.size === 0) {
			throw new Error("Downloaded audio file is empty");
		}

		console.log(`[INFO] Downloaded audio file (${stats.size} bytes)`);
	} catch (error) {
		console.error("[ERROR] Audio download failed:", error);
		throw new Error(
			`Failed to download audio: ${
				error instanceof Error ? error.message : "Unknown error"
			}`
		);
	}
}

async function convertVideoToWav(
	inputPath: string,
	outputPath: string
): Promise<void> {
	console.log(`[INFO] Converting audio: ${inputPath} -> ${outputPath}`);
	return new Promise((resolve, reject) => {
		ffmpeg(inputPath)
			.audioCodec("pcm_s16le")
			.format("wav")
			.audioChannels(1)
			.audioFrequency(16000)
			.on("error", function (err) {
				console.error("[ERROR] FFmpeg conversion failed:", err);
				reject(new Error(`Audio conversion failed: ${err.message}`));
			})
			.on("end", function () {
				console.log("[INFO] Audio conversion completed");
				resolve();
			})
			.save(outputPath);
	});
}

let transcriberInstance: any;

async function getTranscriber() {
	if (!transcriberInstance) {
		console.log(
			"[INFO] Initializing Whisper model (this may take a moment)..."
		);
		try {
			transcriberInstance = await pipeline(
				"automatic-speech-recognition",
				"Xenova/whisper-base"
			);
			console.log("[INFO] Whisper model initialized successfully");
		} catch (error) {
			console.error("[ERROR] Failed to initialize Whisper model:", error);
			throw new Error(
				`Whisper initialization failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}
	return transcriberInstance;
}

async function cleanup(files: string[]): Promise<void> {
	for (const file of files) {
		try {
			if (fs.existsSync(file)) {
				await fs.promises.unlink(file);
				console.log(`[INFO] Cleaned up: ${file}`);
			}
		} catch (error) {
			console.warn(`[WARN] Failed to cleanup ${file}:`, error);
		}
	}
}

export default async function transcribeYoutubeVideo(
	youtubeUrl: string
): Promise<TranscriptionResponse> {
	const fileId = uuidv4();
	const rawAudioPath = path.join(Output_Dir, `${fileId}.mp3`);
	const wavAudioPath = path.join(Output_Dir, `${fileId}.wav`);

	try {
		console.log(`[INFO] Starting transcription for: ${youtubeUrl}`);

		// Extract video ID
		const videoIdMatch = youtubeUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
		if (!videoIdMatch) {
			throw new Error("Invalid YouTube URL format");
		}
		const videoId = videoIdMatch[1];
		console.log(`[INFO] Extracted video ID: ${videoId}`);

		// Load/refresh OAuth token
		await loadOrRefreshToken();

		// Verify video exists and is accessible
		const videoTitle = await verifyVideo(videoId);

		// Download audio
		await downloadAudioWithYTDLP(youtubeUrl, rawAudioPath);

		// Convert to WAV
		await convertVideoToWav(rawAudioPath, wavAudioPath);

		// Read and process audio data
		console.log(`[INFO] Reading audio file: ${wavAudioPath}`);
		const audioBuffer = await fs.promises.readFile(wavAudioPath);

		// Convert to Float32Array for Whisper
		const int16Array = new Int16Array(
			audioBuffer.buffer,
			audioBuffer.byteOffset,
			audioBuffer.byteLength / 2
		);

		const floatArray = new Float32Array(int16Array.length);
		const normalizationFactor = 32768;

		for (let i = 0; i < floatArray.length; i++) {
			floatArray[i] = int16Array[i] / normalizationFactor;
		}

		console.log(`[INFO] Processed audio: ${floatArray.length} samples`);

		// Check for silent audio
		let maxAmplitude = 0;
		for (let i = 0; i < floatArray.length; i++) {
			const absValue = Math.abs(floatArray[i]);
			if (absValue > maxAmplitude) {
				maxAmplitude = absValue;
			}
		}
		if (maxAmplitude < 0.001) {
			console.warn("[WARN] Audio appears to be silent or very quiet");
		}
		// Transcribe with Whisper
		const transcriber = await getTranscriber();
		console.log("[INFO] Starting transcription...");

		const result = await transcriber(floatArray, {
			chunk_length_s: 30,
			stride_length_s: 5,
			language: "english",
			task: "transcribe",
		});

		// Extract transcription text
		const transcriptionText = Array.isArray(result)
			? result
					.map((chunk) => chunk.text)
					.join(" ")
					.trim()
			: (result.text || "").trim();

		console.log(
			`[INFO] Transcription completed (${transcriptionText.length} characters)`
		);

		if (transcriptionText.length === 0) {
			console.warn("[WARN] Transcription result is empty");
		}

		// Clean up temporary files
		await cleanup([rawAudioPath, wavAudioPath]);

		return {
			transcription: transcriptionText,
			error: "",
			success: true,
		};
	} catch (error) {
		console.error("[ERROR] Transcription failed:", error);

		// Clean up on error
		await cleanup([rawAudioPath, wavAudioPath]);

		return {
			transcription: "",
			error: error instanceof Error ? error.message : "Unknown error occurred",
			success: false,
		};
	}
}
