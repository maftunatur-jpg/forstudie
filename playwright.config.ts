import { defineConfig, devices } from "@playwright/test";

// E2E körs i lokalt läge (ingen inloggning/synk) så att testet inte kräver Supabase.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  use: { baseURL: "http://localhost:3100", ...devices["Pixel 7"] },
  webServer: {
    command: "npx next dev --port 3100",
    url: "http://localhost:3100/login",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_LOCAL_ONLY: "1" },
  },
});
