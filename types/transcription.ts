export interface TranscriptionRequest {
	youtubeUrl: string;
}

export interface TranscriptionResponse {
	transcription?: string;
	error?: string;
	success: boolean;
}
