// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
	output: 'server',
	adapter: undefined, // For now, using Node.js adapter (install @astrojs/node if deploying to Node)
	integrations: [tailwind()],
});
