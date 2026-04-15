// client/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // ⭐️ 데스크톱 앱(Electron) 환경을 위해 절대경로를 상대경로로 변경
})