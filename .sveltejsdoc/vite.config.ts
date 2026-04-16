import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: "127.0.0.1",
		port: 5111,
		strictPort: true,
		fs: {
			allow: ["/Users/akcodeworks/dev/vite-sveltejsdocs", "/Users/akcodeworks/dev/vite-sveltejsdocs/node_modules"]
		}
	}
});
