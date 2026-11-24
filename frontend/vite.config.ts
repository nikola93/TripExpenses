import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // API_PROXY_TARGET lets the Docker dev service point at the backend container.
  const env = loadEnv(mode, ".", "API_");

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Forward API calls to the Go backend during development.
      proxy: {
        "/tripexpenses.v1.TripExpensesService":
          env.API_PROXY_TARGET || "http://localhost:8080",
      },
      port: 1604,
    },
  };
});
