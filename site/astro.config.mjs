import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// The docs live at sproutboat.com/ikada. The build writes under dist/ikada so the files sit at
// the same paths they are served from, whether this app is visited directly or through the
// sproutboat.com proxy (see README.md, "Deploying").
export default defineConfig({
  site: "https://sproutboat.com",
  base: "/ikada",
  outDir: "./dist/ikada",
  build: { format: "file" },
  trailingSlash: "ignore",
  devToolbar: { enabled: false },
  prefetch: { defaultStrategy: "hover" },
  integrations: [react()],
  server: { host: true },
  vite: {
    plugins: [tailwindcss()],
    // ikada's source sits one level up; React must stay a single copy across both.
    resolve: { dedupe: ["react", "react-dom"] },
    server: { fs: { allow: [".."] } },
  },
});
