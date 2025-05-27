import puppeteer, { Cookie } from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { env } from "../config/env";

export async function updateYouTubeCookies(): Promise<void> {
	if (!env.YOUTUBE_EMAIL || !env.YOUTUBE_PASSWORD) {
		throw new Error(
			"Missing YOUTUBE_EMAIL or YOUTUBE_PASSWORD environment variables"
		);
	}

	const browser = await puppeteer.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});
	const page = await browser.newPage();

	try {
		console.log("[INFO] Navigating to YouTube for cookie refresh");
		await page.goto("https://www.youtube.com", { waitUntil: "networkidle2" });

		// Simulate login
		await page.type("#identifierId", env.YOUTUBE_EMAIL);
		await page.click("#identifierNext");
		await new Promise((resolve) => setTimeout(resolve, 2000));
		await page.type('input[type="password"]', env.YOUTUBE_PASSWORD);
		await page.click("#passwordNext");
		await page.waitForNavigation({ waitUntil: "networkidle2" });

		// Handle consent screen
		const consentButton = await page.$('button[aria-label*="Accept"]');
		if (consentButton) {
			await consentButton.click();
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		// Extract cookies
		const cookies = await page.cookies(
			"https://www.youtube.com",
			"https://accounts.google.com"
		);
		const cookiesPath = path.resolve(__dirname, "../cookies.txt");
		const netscapeCookies = cookies
			.map((cookie: Cookie) => {
				const isHostOnly = !cookie.domain.startsWith(".");
				return `${cookie.domain}\t${isHostOnly ? "FALSE" : "TRUE"}\t${
					cookie.path
				}\t${cookie.secure ? "TRUE" : "FALSE"}\t${cookie.expires || 0}\t${
					cookie.name
				}\t${cookie.value}`;
			})
			.join("\n");

		await fs.writeFile(cookiesPath, netscapeCookies);
		console.log("[INFO] Updated cookies.txt successfully");
	} catch (error) {
		console.error(
			"[ERROR] Failed to update cookies:",
			error instanceof Error ? error.message : String(error)
		);
		throw error;
	} finally {
		await browser.close();
	}
}
