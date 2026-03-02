import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default ({ mode }) => {
  // Carga .env/.env.local para que Vite tenga VITE_API_TARGET
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_TARGET || "http://127.0.0.1:8000";

  return defineConfig({
    plugins: [react()],
    server: {
      host: true, // para abrir desde el celular con --host
      proxy: {
        "/api": {
          target: "https://le-api.gestion-informes.esy.es",            // -> http://127.0.0.1:8000
          changeOrigin: true,
          secure: true,
          // NO rewrite: /api/recetas -> http://127.0.0.1:8000/api/recetas
        },
      },
    },
  });
};
