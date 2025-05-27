import { updateYouTubeCookies } from "./utils/updateCookies";

updateYouTubeCookies().catch((error) => {
	console.error(
		"[CRITICAL ERROR] Failed to update cookies:",
		error instanceof Error ? error.message : String(error)
	);
	process.exit(1);
});
