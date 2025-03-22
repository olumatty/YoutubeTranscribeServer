import { CronJob } from 'cron';

import sampleCronJob from '../cron/sampleJob';

import { logger } from '../utils/logger';

interface CronJobConfig {
	name: string;
	schedule: string;
	timezone: string;
	handler: () => Promise<void>;
}

const jobs: CronJobConfig[] = [
	{
		name: 'sampleCronJob',
		// Runs at 23:35 (11:35 PM) UTC every day
		schedule: '35 23 * * *',
		timezone: 'UTC',
		handler: sampleCronJob,
	},
];

class CronService {
	private jobs: Map<string, CronJob> = new Map();
	private runningJobs: Set<string> = new Set();
	private isShuttingDown = false;
	private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

	private readonly defaultJobs: CronJobConfig[] = jobs;
	private readonly maxRetries = 3;
	private readonly initialRetryDelay = 5000; // 5 seconds

	private async executeJob(
		config: CronJobConfig,
		retryCount = 0
	): Promise<void> {
		const { name, handler } = config;

		if (this.isShuttingDown || this.runningJobs.has(name)) {
			return;
		}

		this.runningJobs.add(name);
		logger.info(`Starting job ${name} at ${new Date().toISOString()}`);

		try {
			await handler();
			logger.info(`Job ${name} completed successfully.`);
		} catch (error) {
			logger.error(`Job ${name} failed: ${error}`);

			// Handle retries with exponential backoff
			if (retryCount < this.maxRetries) {
				const delay = this.initialRetryDelay * Math.pow(2, retryCount);
				logger.info(
					`Scheduling retry ${retryCount + 1} for job ${name} in ${delay}ms`
				);

				const timeoutId = setTimeout(() => {
					this.executeJob(config, retryCount + 1);
					this.retryTimeouts.delete(name);
				}, delay);

				this.retryTimeouts.set(name, timeoutId);
			}
		} finally {
			this.runningJobs.delete(name);
		}
	}

	private createJob(config: CronJobConfig): CronJob {
		return new CronJob(
			config.schedule,
			() => this.executeJob(config),
			null,
			false,
			config.timezone
		);
	}

	public initialize(): void {
		// Only run cron in production environment
		if (process.env.NODE_ENV !== 'production') return;

		if (this.isShuttingDown) return;

		// Clear existing jobs before starting
		this.jobs.forEach((job) => job.stop());
		this.jobs.clear();
		this.runningJobs.clear();
		this.clearAllRetryTimeouts();

		this.defaultJobs.forEach((config) => {
			const job = this.createJob(config);
			this.jobs.set(config.name, job);
			job.start();
			logger.info(
				`Initialized job ${config.name} with schedule ${config.schedule} (${config.timezone})`
			);
		});

		this.setupShutdown();
	}

	private clearAllRetryTimeouts(): void {
		this.retryTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
		this.retryTimeouts.clear();
	}

	public addJob(config: CronJobConfig): void {
		if (this.jobs.has(config.name)) {
			logger.warn(`Job ${config.name} already exists. Skipping.`);
			return;
		}
		const job = this.createJob(config);
		this.jobs.set(config.name, job);
		job.start();
		logger.info(
			`Added new job ${config.name} with schedule ${config.schedule}`
		);
	}

	public removeJob(jobName: string): void {
		const job = this.jobs.get(jobName);
		if (job) {
			job.stop();
			this.jobs.delete(jobName);
			// Clear any pending retries
			const timeoutId = this.retryTimeouts.get(jobName);
			if (timeoutId) {
				clearTimeout(timeoutId);
				this.retryTimeouts.delete(jobName);
			}
			logger.info(`Removed job ${jobName}`);
		}
	}

	private async gracefulShutdown(): Promise<void> {
		if (this.isShuttingDown) return;
		this.isShuttingDown = true;

		logger.info('Initiating graceful shutdown of cron service...');

		this.jobs.forEach((job) => job.stop());
		this.clearAllRetryTimeouts();

		if (this.runningJobs.size > 0) {
			logger.info(
				`Waiting for ${this.runningJobs.size} running jobs to complete...`
			);
			const timeout = setTimeout(() => {
				logger.warn('Shutdown timeout reached, forcing exit');
				process.exit(0);
			}, 10000);

			while (this.runningJobs.size > 0) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}

			clearTimeout(timeout);
		}

		this.jobs.clear();
		this.runningJobs.clear();
		logger.info('Cron service shutdown complete.');
		process.exit(0);
	}

	private setupShutdown(): void {
		process.on('SIGTERM', () => this.gracefulShutdown());
		process.on('SIGINT', () => this.gracefulShutdown());
	}
}

export default CronService;
