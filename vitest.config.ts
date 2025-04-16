import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
	console.log('mode', mode);
	return {
		test: {
			env: loadEnv(mode, process.cwd(), ''),
			environment: 'node',
			globals: true,
			include: ['tests/**/*.test.ts'],
			// setupFiles: ['tests/setup.ts'],
			silent: false,
		},
	};
});
