export async function wait(durationInSeconds = 2) {
	return new Promise((resolve) =>
		setTimeout(resolve, durationInSeconds * 1000)
	);
}

export function chunkArray<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
}
