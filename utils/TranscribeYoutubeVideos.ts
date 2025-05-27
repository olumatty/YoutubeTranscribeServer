import youtubedl from "youtube-dl-exec";
import fs, { createReadStream } from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { cat, pipeline } from "@xenova/transformers";
import { v4 as uuidv4 } from "uuid";
import { TranscriptionResponse } from "../types/transcription";
import wav from "wav"; // eslint-disable-line @typescript-esli/no-unused-vars
import { updateYouTubeCookies } from "./updateCookies";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const Output_Dir = path.join(__dirname, "temp_audio");

if (!fs.existsSync(Output_Dir)) {
	fs.mkdirSync(Output_Dir, { recursive: true });
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

	const lines = cookiesContent
		.split("\n")
		.filter((line) => !line.startsWith("#") && line.trim());
	const hasValidCookies = lines.some((line) => {
		const parts = line.split("\t");
		if (parts.length < 7) return false; // Ensure all parts are present
		const [domain, hostOnly, path, secure, expires, name, value] = parts;
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
			"[WARN] No valid cookies found in cookies.txt. Please update your cookies."
		);
		// await updateYouTubeCookies();
	}

	const MAX_FILE_SIZE_MB = 50;
	const downloadOptions = {
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
	};

	try {
		await youtubedl(youtubeUrl, downloadOptions);
		const stats = fs.statSync(outputPath);
		if (stats.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
			fs.unlinkSync(outputPath); // Clean up if file is too large
			throw new Error(`Downloaded file exceeds ${MAX_FILE_SIZE_MB} MB limit`);
		}
	} catch (error) {
		if (
			error instanceof Error ||
			String(error).includes("403") ||
			String(error).includes("Login required")
		) {
			console.warn("[WARN] Invalid cookies detected, refreshing...");
			//await updateYouTubeCookies();
			await youtubedl(youtubeUrl, downloadOptions);
			const stats = fs.statSync(outputPath);
			if (stats.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
				fs.unlinkSync(outputPath);
				throw new Error(
					`Audio file exceeds ${MAX_FILE_SIZE_MB} MB limit. Try a shorter video.`
				);
			}
		} else {
			throw error;
		}
	}
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
	const fileId = uuidv4();
	const rawAudioPath = path.join(Output_Dir, `${fileId}.mp3`);
	const wavAudioPath = path.join(Output_Dir, `${fileId}.wav`);

	try {
		console.log(`\n--- Transcription Request for URL: ${youtubeUrl} ---`);

		await downloadAudioWithYTDLP(youtubeUrl, rawAudioPath);
		console.log(`[INFO] Downloaded audio to: ${rawAudioPath}`);

		await convertVideoToWav(rawAudioPath, wavAudioPath);
		console.log(`[INFO] Converted to WAV: ${wavAudioPath}`);

		console.log(`[INFO] Streaming WAV file: ${wavAudioPath}`);
		const fileStream = createReadStream(wavAudioPath);
		const wavReader = new wav.Reader();
		fileStream.pipe(wavReader);

		const chunks: Buffer[] = [];
		wavReader.on("data", (chunk: Buffer) => chunks.push(chunk));
		await new Promise((resolve, reject) => {
			wavReader.on("end", resolve);
			wavReader.on("error", reject);
		});

		const audioBuffer = Buffer.concat(chunks);
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

		console.log("[INFO] Float32Array details:", {
			length: floatArray.length,
			first10: floatArray.slice(0, 10),
			last10: floatArray.slice(-10),
			isAllZeros: floatArray.every((val) => val === 0),
		});

		const transcriber = await getTranscriber();
		console.log("[INFO] Starting transcription with Xenova/whisper-tiny");
		const result = await transcriber(floatArray, {
			chunk_length_s: 30,
			stride_length_s: 5,
			language: "english",
			task: "transcribe",
		});
		console.log("[INFO] Transcription process finished");

		await Promise.all([
			fs.promises
				.unlink(rawAudioPath)
				.catch((err) =>
					console.warn(
						`[WARN] Failed to delete ${rawAudioPath}: ${err.message}`
					)
				),
			fs.promises
				.unlink(wavAudioPath)
				.catch((err) =>
					console.warn(
						`[WARN] Failed to delete ${wavAudioPath}: ${err.message}`
					)
				),
		]);
		console.log("[INFO] Temporary files cleaned up");

		const transcriptionText = Array.isArray(result)
			? result.map((chunk) => chunk.text).join(" ")
			: result.text || "";
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

		if (global.gc) {
			global.gc();
			console.log("[INFO] Triggered garbage collection");
		}

		return {
			transcription: transcriptionText,
			error: "",
			success: true,
		};
	} catch (error) {
		console.error(
			`[CRITICAL ERROR] Transcription failed for ${youtubeUrl}:`,
			error instanceof Error ? error.stack : String(error)
		);
		let errorMessage = `Failed to transcribe video: ${
			error instanceof Error ? error.message : String(error)
		}`;
		if (
			errorMessage.includes("403") ||
			errorMessage.includes("Login Required")
		) {
			errorMessage = "Invalid or expired cookies. Please update cookies.txt.";
		}

		await Promise.all([
			fs.promises.unlink(rawAudioPath).catch(() => {}),
			fs.promises.unlink(wavAudioPath).catch(() => {}),
		]);

		return {
			transcription: "",
			error: errorMessage,
			success: false,
		};
	}
}
