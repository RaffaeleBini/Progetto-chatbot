import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // In sviluppo punta all'emulatore Hosting (`firebase emulators:start`),
      // che applica gli stessi rewrite verso le Functions usati in produzione.
      "/api": "http://127.0.0.1:5000",
    },
  },
});
