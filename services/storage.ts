import crypto from 'crypto';
import { env } from '../config/env';
import CustomError from '../utils/customError';

interface AuthorizeAccountResponse {
	accountId: string;
	apiUrl: string;
	authorizationToken: string;
	downloadUrl: string;
	recommendedPartSize: number;
}

interface GetUploadUrlResponse {
	authorizationToken: string;
	bucketId: string;
	uploadUrl: string;
}

interface FileUploadResponse {
	accountId: string;
	bucketId: string;
	contentLength: number;
	contentSha1: string;
	contentType: string;
	fileId: string;
	fileInfo: Record<string, string>;
	fileName: string;
	uploadTimestamp: number;
}

interface GetDownloadAuthorizationResponse {
	authorizationToken: string;
	bucketId: string;
	fileNamePrefix: string;
}

/**
 * Backblaze B2 Storage Service
 * Used for uploading and managing files on B2 Cloud Storage
 */
export class BackblazeB2Service {
	// Local Credentials
	private accountId: string;
	private applicationKey: string;
	private bucketId: string;
	private bucketName: string;

	// Authentication Credentials
	private authToken: string = '';
	private apiUrl: string = '';
	private downloadUrl: string = '';

	// Upload Credentials
	private uploadUrl: string = '';
	private uploadAuthorizationToken: string = '';

	constructor({
		bucketId,
		bucketName,
	}: {
		bucketId: string;
		bucketName: string;
	}) {
		this.accountId = env.B2_APPLICATION_KEY_ID;
		this.applicationKey = env.B2_APPLICATION_KEY;
		this.bucketId = bucketId;
		this.bucketName = bucketName;

		if (
			!this.accountId ||
			!this.applicationKey ||
			!this.bucketId ||
			!this.bucketName
		) {
			throw new Error(
				'Missing Backblaze B2 configuration. Please check your environment variables.'
			);
		}
	}

	/**
	 * Authenticate with Backblaze B2 API
	 */
	private async authenticate(): Promise<void> {
		try {
			const authString = Buffer.from(
				`${this.accountId}:${this.applicationKey}`
			).toString('base64');

			const response = await fetch(
				'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
				{
					headers: {
						Authorization: `Basic ${authString}`,
					},
				}
			);

			if (!response.ok) {
				throw new Error(
					`Authentication failed with status: ${response.status}`
				);
			}

			const data = (await response.json()) as AuthorizeAccountResponse;
			this.authToken = data.authorizationToken;
			this.apiUrl = data.apiUrl;
			this.downloadUrl = data.downloadUrl;
		} catch (error) {
			console.error('Error authenticating with Backblaze B2:', error);
			throw CustomError.ThirdPartyServiceError(
				'Failed to authenticate with storage service'
			);
		}
	}

	/**
	 * Get upload URL from Backblaze B2
	 */
	private async getUploadUrl(): Promise<void> {
		try {
			const response = await fetch(
				`${this.apiUrl}/b2api/v2/b2_get_upload_url`,
				{
					method: 'POST',
					headers: {
						Authorization: this.authToken,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ bucketId: this.bucketId }),
				}
			);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(`[${response.status}] ${JSON.stringify(errorData)}`);
			}

			const data = (await response.json()) as GetUploadUrlResponse;

			this.uploadUrl = data.uploadUrl;
			this.uploadAuthorizationToken = data.authorizationToken;
		} catch (error) {
			console.error('Error getting upload URL:', error);
			throw CustomError.InternalServerError(
				'Failed to get upload URL from storage service'
			);
		}
	}

	/**
	 * Ensure that the file does not already exist in the bucket
	 * @param destinationPath The path to the file in the bucket
	 */
	private async ensureExistingFileIsNotOverridden(
		destinationPath: string
	): Promise<void> {
		try {
			const response = await fetch(
				`${this.apiUrl}/b2api/v2/b2_list_file_names`,
				{
					method: 'POST',
					headers: {
						Authorization: this.authToken,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						bucketId: this.bucketId,
						prefix: destinationPath,
						maxFileCount: 1,
					}),
				}
			);

			if (response.ok) {
				const listData = (await response.json()) as {
					files: Array<{ fileName: string }>;
				};

				const fileExists = listData.files.some(
					(file) => file.fileName === destinationPath
				);

				if (fileExists) {
					throw CustomError.BadRequest(
						`File ${destinationPath} already exists and override is set to false`
					);
				}
			}
		} catch (error) {
			if (error instanceof CustomError) {
				throw error;
			}
			// If there's an error checking file existence, we'll just continue with the upload
			console.warn(
				'Error checking if file exists, proceeding with upload:',
				error
			);
		}
	}

	/**
	 * Upload a file buffer to Backblaze B2
	 * @param file Multer file object containing file data
	 * @param destinationPath Path to the file in the bucket
	 * @param overrideExisting Whether to override existing file with the same name (default: true)
	 * @returns URL of the uploaded file
	 */
	public async uploadFile(
		file: Express.Multer.File,
		destinationPath: string,
		overrideExisting: boolean = true
	): Promise<string> {
		try {
			// Authenticate if not already authenticated, as this is needed to get the upload URL
			if (!this.authToken || !this.apiUrl) {
				await this.authenticate();
			}

			// Check if the file exists if we don't want to override
			if (!overrideExisting) {
				await this.ensureExistingFileIsNotOverridden(destinationPath);
			}

			await this.getUploadUrl();

			// Add validation for fileBuffer
			if (!file || !file.buffer) {
				throw new Error('File or file buffer is undefined or empty');
			}

			// Create SHA1 hash of the buffer
			const sha1 = crypto.createHash('sha1').update(file.buffer).digest('hex');

			const response = await fetch(this.uploadUrl, {
				method: 'POST',
				headers: {
					Authorization: this.uploadAuthorizationToken,
					'Content-Type': file.mimetype,
					'Content-Length': file.size.toString(),
					'X-Bz-File-Name': encodeURIComponent(destinationPath),
					'X-Bz-Content-Sha1': sha1,
				},
				body: file.buffer,
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(`[${response.status}] ${JSON.stringify(errorData)}`);
			}

			(await response.json()) as FileUploadResponse;

			// Return the url of the uploaded file
			return `${this.downloadUrl}/file/${this.bucketName}/${destinationPath}`;
		} catch (error) {
			console.error('Error uploading buffer to Backblaze B2:', error);
			if (error instanceof CustomError) {
				throw error;
			}
			throw CustomError.InternalServerError(
				'Failed to upload file to storage service'
			);
		}
	}

	/**
	 * Delete a file from Backblaze B2
	 * @param fileName Name of the file to delete
	 */
	public async deleteFile(fileName: string): Promise<void> {
		if (!this.authToken || !this.apiUrl) {
			await this.authenticate();
		}

		try {
			// First we need to get the file ID
			const listFilesResponse = await fetch(
				`${this.apiUrl}/b2api/v2/b2_list_file_names`,
				{
					method: 'POST',
					headers: {
						Authorization: this.authToken,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						bucketId: this.bucketId,
						prefix: fileName,
						maxFileCount: 1,
					}),
				}
			);

			if (!listFilesResponse.ok) {
				throw new Error(`Failed to list files: ${listFilesResponse.status}`);
			}

			const listData = (await listFilesResponse.json()) as {
				files: Array<{ fileId: string }>;
			};
			const files = listData.files;

			if (files.length === 0) {
				throw CustomError.NotFound(`File ${fileName} not found`);
			}

			const fileId = files[0].fileId;

			// Now delete the file
			const deleteResponse = await fetch(
				`${this.apiUrl}/b2api/v2/b2_delete_file_version`,
				{
					method: 'POST',
					headers: {
						Authorization: this.authToken,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						fileName,
						fileId,
					}),
				}
			);

			if (!deleteResponse.ok) {
				throw new Error(`File deletion failed: ${deleteResponse.status}`);
			}
		} catch (error) {
			console.error('Error deleting file from Backblaze B2:', error);
			throw CustomError.InternalServerError(
				'Failed to delete file from storage service'
			);
		}
	}

	/**
	 * Get a temporary download URL with authorization for a file
	 * @param fileName Name of the file to generate download URL for
	 * @param validDurationInSeconds How long the download URL should be valid (default: 1 day)
	 * @returns Authorized download URL for the file
	 */
	public async getDownloadUrl(
		fileUrl: string,
		validDurationInSeconds: number = 86400
	): Promise<string> {
		// Authenticate if not already authenticated
		if (!this.authToken || !this.apiUrl || !this.downloadUrl) {
			await this.authenticate();
		}

		const filePath = fileUrl.split('file/')[1].split('/').slice(1).join('/');

		try {
			const response = await fetch(
				`${this.apiUrl}/b2api/v2/b2_get_download_authorization`,
				{
					method: 'POST',
					headers: {
						Authorization: this.authToken,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						bucketId: this.bucketId,
						fileNamePrefix: filePath,
						validDurationInSeconds,
					}),
				}
			);

			if (!response.ok) {
				throw new Error(
					`Failed to get download authorization: ${response.status}`
				);
			}

			const data = (await response.json()) as GetDownloadAuthorizationResponse;

			// Return the authorized download URL
			return `${this.downloadUrl}/file/${this.bucketName}/${filePath}?Authorization=${data.authorizationToken}`;
		} catch (error) {
			console.error('Error getting download URL from Backblaze B2:', error);
			throw CustomError.InternalServerError(
				'Failed to generate download URL from storage service'
			);
		}
	}
}
