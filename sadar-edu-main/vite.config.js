import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Port tetap mencegah Vite pindah diam-diam ke alamat proyek lain saat port sibuk.
// Proxy lokal menghindari ketergantungan pada origin CORS backend untuk tiap port FE.
const localServer = {
  host: '127.0.0.1',
  port: 4174,
  strictPort: true,
  proxy: { '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true } },
}

export default defineConfig({
  plugins: [react()],
  server: localServer,
  preview: localServer,
})
