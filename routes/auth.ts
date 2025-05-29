import { google } from "googleapis";
import path from "path";
import { env } from "../config/env";

export const TOKEN_PATH = path.join(__dirname, "../youtube_token.json");

export const oauth2Client = new google.auth.OAuth2(
	env.GOOGLE_CLIENT_ID,
	env.GOOGLE_CLIENT_SECRET,
	env.REDIRECT_URI
);
