export interface TranscriptionRequest {
	youtube_url: string;
}

export interface TranscriptionResponse {
	transcription?: string;
	error?: string;
	success: boolean;
}

export interface VideoInfo {
	title: string;
	description: string;
	thumbnail: string;
	duration: number;
	author: string;
}

export interface VideoInfoResponse {
	video_info?: VideoInfo;
	error?: string;
	success: boolean;
}
