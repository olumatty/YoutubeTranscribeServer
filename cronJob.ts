import { schedule } from "node-cron";
import { updateYouTubeCookies } from "./utils/updateCookies";

schedule("0 0 * * *", async () => {
	console.log("[INFO] Updating cookies...");
	try {
		await updateYouTubeCookies();
		console.log("[INFO] Cookies updated successfully.");
	} catch (error) {
		console.error(
			"[ERROR] Failed to update cookies:",
			error instanceof Error ? error.message : String(error)
		);
	}
});
