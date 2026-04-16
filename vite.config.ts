import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { jsAutoDocs } from "./dist/index.js"


export default defineConfig({ plugins: [jsAutoDocs(), tailwindcss(), sveltekit()] });
