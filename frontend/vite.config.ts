import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to the Go backend during development.
    proxy: {
      "/tripexpenses.v1.TripExpensesService": "http://localhost:8080",
    },
    port: 1604,
  },
});
