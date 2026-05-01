export interface TranscriptionRequest {
	youtubeUrl: string;
}

export interface TranscriptSegment {
	text: string;
	offset: number;
	duration: number;
}

export interface TranscriptionResponse {
	transcription?: string;
	videoId?: string;
	segments?: TranscriptSegment[];
	error?: string;
	success: boolean;
}
