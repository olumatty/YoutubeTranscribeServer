export async function runScript(
	runnableScript: (() => Promise<any>) | (() => any)
): Promise<void> {
	const startTime = Date.now();

	try {
		console.log('Running script...');

		await runnableScript();

		// If everything goes well, exit the process with code 0 (success)
		console.log(`Done in: ${(Date.now() - startTime) / 1000} seconds`);
		console.log('Exiting successfully.');
		process.exit(0);
	} catch (error) {
		console.error('An error occurred:', error);

		// Exit with a non-zero code in case of failure
		console.log(`Ran for: ${(Date.now() - startTime) / 1000} seconds`);
		process.exit(1);
	}
}
