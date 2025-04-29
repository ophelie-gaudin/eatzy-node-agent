import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
	build: {
		outDir: 'dist',
		lib: {
			entry: resolve(__dirname, 'src/main.ts'),
			formats: ['cjs'],
			fileName: 'main',
		},
		rollupOptions: {
			external: [
				'express',
				'cors',
				'dotenv',
				'@nestjs/core',
				'@nestjs/common',
				'@nestjs/platform-express',
				'rxjs',
				'reflect-metadata',
				'class-validator',
				'class-transformer',
				'fs',
				'path',
				'util',
				'uuid',
			],
		},
		sourcemap: true,
		emptyOutDir: true,
		ssr: true,
		target: 'node18',
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src'),
		},
	},
})
