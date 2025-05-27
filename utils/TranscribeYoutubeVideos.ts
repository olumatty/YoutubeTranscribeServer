import youtubedl from "youtube-dl-exec";
import fs, { createReadStream } from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { pipeline } from "@xenova/transformers";
import { v4 as uuidv4 } from "uuid";
import { TranscriptionResponse } from "../types/transcription";
import { WaveFile } from "wavefile";

// import { updateYouTubeCookies } from "./updateCookies";

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

	const MAX_FILE_SIZE_MB = 25;
	const downloadOptions = {
		extractAudio: true,
		audioFormat: "mp3",
		output: path.resolve(outputPath),
		noCheckCertificates: true,
		referer: youtubeUrl,
		quiet: true,
		cookies: cookiesPath,
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
			error instanceof Error ||
			String(error).includes("403") ||
			String(error).includes("Login required")
		) {
			console.warn("[WARN] Invalid cookies detected, refreshing...");
			// await updateYouTubeCookies();
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
			"[INFO] Initializing ASR pipeline (Xenova/whisper-tiny.en) for the first time..."
		);
		try {
			transcriberInstance = await pipeline(
				"automatic-speech-recognition",
				"Xenova/whisper-tiny.en"
			);
			console.log("[INFO] ASR pipeline initialized.");
		} catch (error) {
			console.error(
				`[CRITICAL ERROR] Failed to initialize ASR pipeline (Xenova/whisper-tiny.en): ${
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

		console.log(
			`[INFO] Reading WAV file into memory with wavefile: ${wavAudioPath}`
		);
		const wavBuffer = fs.readFileSync(wavAudioPath);
		const wav = new WaveFile(wavBuffer);

		wav.toBitDepth("32f"); // This sets the internal bit depth to 32-bit float
		wav.toSampleRate(16000); // And sample rate to 16kHz

		const audioData = wav.getSamples(); // This will return a Float64Array or an array of Float64Arrays

		let float32AudioData: Float32Array;

		if (Array.isArray(audioData)) {
			const firstChannel = audioData[0] as Float64Array; // Assert to Float64Array
			float32AudioData = new Float32Array(firstChannel); // Convert to Float32Array
		} else {
			// If mono, getSamples returns a single Float64Array.
			const monoChannel = audioData as Float64Array; // Assert to Float64Array
			float32AudioData = new Float32Array(monoChannel); // Convert to Float32Array
		}

		console.log("[INFO] Float32Array details:", {
			length: float32AudioData.length,
			first10: float32AudioData.slice(0, 10),
			last10: float32AudioData.slice(-10),
			isAllZeros: float32AudioData.every((val) => val === 0),
		});

		const transcriber = await getTranscriber();
		console.log("[INFO] Starting transcription with Xenova/whisper-tiny.en");
		// Pass the converted Float32Array directly
		const result = await transcriber(float32AudioData, {
			chunk_length_s: 10,
			stride_length_s: 2,
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
