import node from "@astrojs/node";
// @ts-check
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

import vue from "@astrojs/vue";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: ({command}) => ({
    host: command === "dev" ? "127.0.0.1" : "0.0.0.0"
  }),

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [vue()],
});
