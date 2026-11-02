import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 5173, host: true },
  build: {
    // Explicit browser support: last ~4 years of Chrome/Edge/Firefox and Safari 14+ (iOS 14+).
    target: ["es2019", "chrome87", "edge88", "firefox78", "safari14", "ios14"],
    cssTarget: ["chrome87", "edge88", "firefox78", "safari14", "ios14"],
  },
});
