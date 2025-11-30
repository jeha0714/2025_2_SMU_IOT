import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0", // 모든 인터페이스에서 수신
    port: 5173, // 필요하면 다른 포트 지정
    strictPort: true, // 포트가 이미 쓰이면 실패하도록 (선택)
  },
});
