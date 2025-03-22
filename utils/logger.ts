type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogColors {
	info: string;
	warn: string;
	error: string;
	debug: string;
	reset: string;
}

const colors: LogColors = {
	info: '\x1b[36m', // Cyan
	warn: '\x1b[33m', // Yellow
	error: '\x1b[31m', // Red
	debug: '\x1b[35m', // Magenta
	reset: '\x1b[0m', // Reset
};

class Logger {
	private getTimestamp(): string {
		return new Date().toISOString();
	}

	private formatMessage(
		level: LogLevel,
		message: string,
		...args: any[]
	): string {
		const timestamp = this.getTimestamp();
		const formattedArgs = args.length ? JSON.stringify(args) : '';
		return `${
			colors[level]
		}[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}${
			colors.reset
		}`;
	}

	info(message: string, ...args: any[]): void {
		console.log(this.formatMessage('info', message, ...args));
	}

	warn(message: string, ...args: any[]): void {
		console.warn(this.formatMessage('warn', message, ...args));
	}

	error(message: string, ...args: any[]): void {
		console.error(this.formatMessage('error', message, ...args));
	}

	debug(message: string, ...args: any[]): void {
		if (process.env.NODE_ENV !== 'production') {
			console.debug(this.formatMessage('debug', message, ...args));
		}
	}
}

export const logger = new Logger();
