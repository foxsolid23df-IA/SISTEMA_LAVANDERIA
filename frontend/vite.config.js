import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	base: './',
    envDir: '../', // Busca las variables .env en la raíz del proyecto
	build: {
		outDir: 'dist',
		emptyOutDir: true
	}
})
