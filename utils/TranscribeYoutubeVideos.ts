import express, { Response, Request } from "express";
import youtubedl from "youtube-dl-exec";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { pipeline } from "@xenova/transformers";
import { v4 as uuidv4 } from "uuid";
import { TranscriptionResponse } from "../types/transcription";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const Output_Dir = path.join(__dirname, "temp_audio");

if (!fs.existsSync(Output_Dir)) {
	fs.mkdirSync(Output_Dir);
	console.log(`[INFO] Created temporary audio directory: ${Output_Dir}`);
}

async function downloadAudioWithYTDLP(
	youtubeUrl: string,
	outputPath: string
): Promise<void> {
	console.log(`[INFO] Attempting to download audio to: ${outputPath}`);

	const cookiesPath = path.resolve(__dirname, "../cookies.txt");
	console.log(`[INFO] Cookies path: ${cookiesPath}`);

	if (!fs.existsSync(cookiesPath)) {
		throw new Error("Cookies file not found. Please update cookies.");
	}

	const cookiesContent = fs.readFileSync(cookiesPath, "utf-8");
	if (!cookiesContent.trim()) {
		throw new Error("Cookies file is empty. Please provide valid cookies.");
	}

	await youtubedl(youtubeUrl, {
		extractAudio: true,
		audioFormat: "mp3",
		output: path.resolve(outputPath),
		noCheckCertificates: true,
		referer: youtubeUrl,
		quiet: true,
		cookies: cookiesPath,
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36", // Add a realistic user agent
		addHeader: ["accept-language: en-US,en;q=0.9"],
		sleepInterval: 10,
		retries: 5,
	});
}

async function convertVideoToWav(
	inputPath: string,
	outputPath: string
): Promise<void> {
	console.log(
		`[INFO] Starting FFmpeg conversion: ${inputPath} -> ${outputPath}`
	);
	return new Promise((resolve, reject) => {
		ffmpeg(inputPath)
			.audioCodec("pcm_s16le")
			.format("wav")
			.audioChannels(1)
			.audioFrequency(16000)
			.on("error", function (err) {
				reject(err);
			})
			.on("end", function () {
				resolve();
			})
			.save(outputPath);
	});
}

let transcriberInstance: any;

async function getTranscriber() {
	if (!transcriberInstance) {
		console.log(
			"[INFO] Initializing ASR pipeline (Xenova/whisper-tiny) for the first time..."
		);
		try {
			transcriberInstance = await pipeline(
				"automatic-speech-recognition",
				"Xenova/whisper-tiny"
			);
			console.log("[INFO] ASR pipeline initialized.");
		} catch (error) {
			console.error(
				`[CRITICAL ERROR] Failed to initialize ASR pipeline (Xenova/whisper-tiny): ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			throw error;
		}
	} else {
		console.log("[INFO] Using existing ASR pipeline instance.");
	}
	return transcriberInstance;
}

export default async function transcribeYoutubeVideo(
	youtubeUrl: string
): Promise<TranscriptionResponse> {
	try {
		console.log(`\n--- Transcription Request for URL: ${youtubeUrl} ---`);

		const fileId = uuidv4();
		const rawAudioPath = path.join(Output_Dir, `${fileId}.mp3`);
		const wavAudioPath = path.join(Output_Dir, `${fileId}.wav`);
		console.log(`[INFO] Attempting to download audio to: ${rawAudioPath}`);

		await downloadAudioWithYTDLP(youtubeUrl, rawAudioPath);

		const rawAudioStats = fs.statSync(rawAudioPath);
		console.log(
			`[INFO] Downloaded raw audio file size: ${rawAudioStats.size} bytes`
		);

		await convertVideoToWav(rawAudioPath, wavAudioPath);

		const wavAudioStats = fs.statSync(wavAudioPath);
		console.log(
			`[INFO] Converted WAV audio file size: ${wavAudioStats.size} bytes`
		);

		console.log(`[INFO] Reading WAV file into buffer: ${wavAudioPath}`);
		const audioBuffer = await fs.promises.readFile(wavAudioPath);

		console.log(
			`[INFO] Creating Float32Array from audioBuffer (byteLength: ${audioBuffer.byteLength})...`
		);

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

		console.log("[INFO] Float32Array details:");
		console.log("  - length:", floatArray.length);
		console.log("  - First 10 values:", floatArray.slice(0, 10));
		console.log("  - Last 10 values:", floatArray.slice(-10));
		const isAllZeros = floatArray.every((val) => val === 0);
		console.log("  - Is Float32Array all zeros (silent audio)?", isAllZeros);

		const transcriber = await getTranscriber();

		console.log(
			"[INFO] Starting transcription with Xenova/whisper-small model..."
		);
		const result = await transcriber(floatArray, {
			chunk_length_s: 30,
			stride_length_s: 5,
			language: "english",
			task: "transcribe",
		});
		console.log("[INFO] Transcription process finished.");

		console.log("[INFO] Cleaning up temporary files...");

		await fs.promises.unlink(rawAudioPath);
		await fs.promises.unlink(wavAudioPath);
		console.log("[INFO] Temporary files cleaned up.");

		const transcriptionText = Array.isArray(result)
			? result.map((chunk) => chunk.text).join(" ")
			: result.text || "";

		console.log(
			`[INFO] Final transcription result length: ${transcriptionText.length}`
		);
		if (transcriptionText.length > 100) {
			console.log(
				`[INFO] Transcription snippet: "${transcriptionText.substring(
					0,
					100
				)}..."`
			);
		} else {
			console.log(`[INFO] Full Transcription result: "${transcriptionText}"`);
		}

		console.log(`--- End Transcription Request ---`);

		return {
			transcription: transcriptionText,
			error: "",
			success: true,
		};
	} catch (error) {
		console.error(
			`[CRITICAL ERROR] Transcription process failed: ${
				error instanceof Error ? error.message : String(error)
			}`
		);

		return {
			transcription: "",
			error: `Failed to transcribe video due to an unexpected error: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
			success: false,
		};
	}
}
