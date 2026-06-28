/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: 'autoUpdate',
			workbox: {
				globPatterns: ['**/*.{js,css,svg,png,jpg,jpeg,gif,ico,woff,woff2,ttf,eot}'],
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
							cacheableResponse: { statuses: [0, 200] }
						}
					},
					{
						urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'gstatic-fonts-cache',
							expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
							cacheableResponse: { statuses: [0, 200] }
						}
					}
				],
				navigateFallback: null
			},
			manifest: {
				name: 'SISTEMA VENTAS | LAVANDERÍA PRO',
				short_name: 'Lavandería PRO',
				description: 'Sistema de Punto de Venta profesional',
				theme_color: '#0f172a',
				background_color: '#0f172a',
				display: 'standalone',
				orientation: 'any',
				start_url: '/',
				icons: [
					{ src: '/vite.svg', sizes: '192x192', type: 'image/svg+xml' },
					{ src: '/vite.svg', sizes: '512x512', type: 'image/svg+xml' }
				]
			}
		})
	],
	define: {
		'APP_VERSION': JSON.stringify(process.env.npm_package_version),
	},
	base: './',
	envDir: './',
	build: {
		outDir: '../dist',
		emptyOutDir: true,
		chunkSizeWarningLimit: 250,
		target: 'es2020',
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router') || id.includes('node_modules/scheduler/')) {
						return 'vendor-react';
					}
					if (id.includes('node_modules/@supabase/')) {
						return 'vendor-supabase';
					}
					if (id.includes('node_modules/react-icons/')) {
						return 'vendor-icons';
					}
					if (id.includes('node_modules/d3-')) {
						return 'vendor-d3';
					}
					if (id.includes('node_modules/recharts')) {
						return 'vendor-recharts';
					}
					if (id.includes('node_modules/jspdf')) {
						return 'vendor-jspdf';
					}
					if (id.includes('node_modules/html2canvas')) {
						return 'vendor-html2canvas';
					}
					if (id.includes('node_modules/xlsx')) {
						return 'vendor-xlsx';
					}
					if (id.includes('node_modules/sweetalert2')) {
						return 'vendor-sweetalert2';
					}
					if (id.includes('node_modules/html5-qrcode') || id.includes('node_modules/qrcode.react')) {
						return 'vendor-qr';
					}
					if (id.includes('node_modules/@sentry/')) {
						return 'vendor-sentry';
					}
					if (id.includes('node_modules/@capacitor/')) {
						return 'vendor-capacitor';
					}
					if (id.includes('node_modules/dompurify')) {
						return 'vendor-dompurify';
					}
				}
			}
		}
	},
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: './src/setupTests.js',
		coverage: {
			reporter: ['text', 'json', 'html'],
			exclude: ['node_modules/', 'src/setupTests.js'],
		},
	},
})
