import express, { Response, Request } from "express";
import ytdl from "@distube/ytdl-core";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { pipeline } from "@xenova/transformers";
import { v4 as uuidv4 } from "uuid";
import { TranscriptionResponse } from "../types/transcription";

const Output_Dir = path.join(__dirname, "temp_audio");

if (!fs.existsSync(Output_Dir)) {
	fs.mkdirSync(Output_Dir);
	console.log(`[INFO] Created temporary audio directory: ${Output_Dir}`);
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
			"[INFO] Initializing ASR pipeline (Xenova/whisper-small) for the first time..."
		);
		transcriberInstance = await pipeline(
			"automatic-speech-recognition",
			"Xenova/whisper-small"
		);
		console.log("[INFO] ASR pipeline initialized.");
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

		if (!ytdl.validateURL(youtubeUrl)) {
			console.warn(`[WARNING] Invalid YouTube URL provided: ${youtubeUrl}`);
			return {
				transcription: " ",
				error: "Invalid Youtube URL",
				success: false,
			};
		}

		const fileId = uuidv4();
		const rawAudioPath = path.join(Output_Dir, `${fileId}.mp4`);
		const wavAudioPath = path.join(Output_Dir, `${fileId}.wav`);
		console.log(`[INFO] Attempting to download audio to: ${rawAudioPath}`);
		await new Promise<void>((resolve, reject) => {
			const audioStream = ytdl(youtubeUrl, {
				quality: "highestaudio",
				filter: "audioonly",
			});

			audioStream
				.pipe(fs.createWriteStream(rawAudioPath))
				.on("finish", () => {
					console.log(`[INFO] Audio download complete: ${rawAudioPath}`);
					resolve();
				})
				.on("error", (err) => {
					console.error(`[ERROR] YTDL download stream error: ${err.message}`);

					if (fs.existsSync(rawAudioPath)) {
						fs.unlinkSync(rawAudioPath);
						console.log(`[INFO] Cleaned up partial download: ${rawAudioPath}`);
					}
					reject(err);
				});
		});

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
			? result[0]?.text || ""
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
