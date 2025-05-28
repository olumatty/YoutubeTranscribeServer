import {
	firefox,
	type Browser,
	type BrowserContext,
	type Page,
} from "playwright";
import fs from "fs/promises";
import path from "path";
import { env } from "../config/env";

export async function updateYouTubeCookies(): Promise<void> {
	if (!env.YOUTUBE_EMAIL || !env.YOUTUBE_PASSWORD) {
		throw new Error(
			"Missing YOUTUBE_EMAIL or YOUTUBE_PASSWORD environment variables. Cannot update cookies."
		);
	}

	let browser: Browser | undefined;
	let context: BrowserContext | undefined;
	let page: Page | undefined;

	try {
		console.log("[INFO] Launching Firefox for cookie refresh...");
		// Launch Firefox
		browser = await firefox.launch({ headless: true });
		context = await browser.newContext({
			userAgent:
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
			// You can also add specific Firefox preferences here if needed
		});
		page = await context.newPage();

		console.log("[INFO] Navigating to YouTube for cookie refresh");
		await page.goto("https://www.youtube.com/", { waitUntil: "networkidle" });

		// Attempt to find and click the sign-in button
		const signInButtonSelector = 'button[aria-label*="Sign in"]';
		try {
			await page.waitForSelector(signInButtonSelector, { timeout: 5000 });
			await page.click(signInButtonSelector);
			await page.waitForLoadState("networkidle");
			console.log("[INFO] Clicked YouTube sign-in button.");
		} catch (e) {
			console.log(
				"[INFO] YouTube sign-in button not found or not needed, proceeding directly to Google login flow."
			);
			await page.goto("https://accounts.google.com/ServiceLogin", {
				waitUntil: "networkidle",
			});
		}

		if (!page.url().includes("accounts.google.com")) {
			console.warn(
				"[WARN] Not on Google accounts page. Trying direct navigation."
			);
			await page.goto("https://accounts.google.com/ServiceLogin", {
				waitUntil: "networkidle",
			});
		}

		// Type email
		await page.waitForSelector("#identifierId", { timeout: 10000 });
		await page.type("#identifierId", env.YOUTUBE_EMAIL);
		await page.click("#identifierNext");
		await page.waitForLoadState("networkidle", { timeout: 10000 }); // Use networkidle for Playwright

		// Type password
		await page.waitForSelector('input[type="password"]', { timeout: 10000 });
		await page.type('input[type="password"]', env.YOUTUBE_PASSWORD);
		await page.click("#passwordNext");
		await page.waitForLoadState("networkidle", { timeout: 15000 });

		// Handle Google consent/privacy screens (Playwright's equivalent of Puppeteer's waitForSelector/click)
		const consentButtonSelector =
			'form[action*="/consent"] button[type="submit"]';
		const agreeButtonSelector = 'button[aria-label*="Agree"]';
		const continueButtonSelector = 'button[aria-label*="Continue"]';

		// Helper to click if element exists and waits
		async function clickIfVisible(
			selector: string,
			page: Page,
			message: string
		) {
			try {
				await page.waitForSelector(selector, {
					state: "visible",
					timeout: 3000,
				});
				await page.click(selector);
				await page.waitForLoadState("networkidle", { timeout: 5000 });
				console.log(`[INFO] ${message}`);
				return true;
			} catch (e) {
				return false;
			}
		}

		await clickIfVisible(
			consentButtonSelector,
			page,
			"Handled a consent form."
		);
		await clickIfVisible(
			agreeButtonSelector,
			page,
			"Handled an 'Agree' button."
		);
		await clickIfVisible(
			continueButtonSelector,
			page,
			"Handled a 'Continue' button after login."
		);

		console.log(
			"[INFO] Successfully navigated and potentially logged in. Current URL:",
			page.url()
		);

		// Extract cookies from the browser context
		const cookies = await context.cookies();
		const cookiesPath = path.resolve(__dirname, "../cookies.txt");

		// Filter for relevant cookies (YouTube, Google domains)
		const filteredCookies = cookies.filter(
			(cookie) =>
				cookie.domain.includes("youtube.com") ||
				cookie.domain.includes("google.com") ||
				cookie.domain.includes("youtube.com")
		);

		const netscapeCookies = filteredCookies
			.map((cookie: any) => {
				const isHostOnly = !cookie.domain.startsWith(".");
				return `<span class="math-inline">\{cookie\.domain\}\\t</span>{isHostOnly ? "FALSE" : "TRUE"}\t${
					cookie.path
				}\t${cookie.secure ? "TRUE" : "FALSE"}\t${
					cookie.expires ? Math.round(cookie.expires) : 0
				}\t${cookie.name}\t${cookie.value}`;
			})
			.join("\n");

		if (netscapeCookies.length === 0) {
			throw new Error(
				"No relevant cookies extracted. Login might have failed or consent not handled."
			);
		}

		await fs.writeFile(cookiesPath, netscapeCookies);
		console.log(
			`[INFO] Updated cookies.txt successfully with ${filteredCookies.length} cookies.`
		);
	} catch (error) {
		console.error(
			"[ERROR] Failed to update cookies:",
			error instanceof Error ? error.message : String(error),
			error instanceof Error ? error.stack : ""
		);
		throw error;
	} finally {
		if (browser) {
			await browser.close();
		}
	}
}
