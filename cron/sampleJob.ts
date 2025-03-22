import { wait } from '../utils';

export default async function sampleCronJob(): Promise<void> {
	console.log('Running sample cron job...');

	console.log('Waiting for 10 seconds...');
	await wait(10);

	console.log('Sample cron job completed');
}
