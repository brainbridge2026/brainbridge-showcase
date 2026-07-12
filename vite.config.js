import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Windows에서 외부 도구(에디터·OneDrive 등)가 파일을 잠그면 네이티브
      // fs.watch 가 EBUSY 를 던지며 Vite 감시자가 통째로 죽는다.
      // usePolling 은 fs.watch 대신 주기적 폴링을 써서 파일이 잠겨도 서버가
      // 살아있게 한다. (CPU 를 약간 더 쓰는 대신 재발 방지 확실)
      usePolling: true,
      interval: 300,
      // 폴링 부하를 줄이려 감시 불필요한 폴더는 제외.
      ignored: ['**/public/td_json/**', '**/docs/**', '**/dist/**'],
    },
  },
})
