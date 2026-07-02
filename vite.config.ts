import { defineConfig } from "vite";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const base = env?.GITHUB_ACTIONS === "true" ? "/mxren-museum/" : "/";

export default defineConfig({
  base,
  server: {
    host: "127.0.0.1",
    port: 4173
  },
  preview: {
    host: "127.0.0.1",
    port: 4174
  }
});
