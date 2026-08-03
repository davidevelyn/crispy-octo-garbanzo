import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    // In sandboxed/CI environments a pre-installed Chromium can be pointed at
    // via CHROMIUM_PATH instead of downloading a browser.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173/crispy-octo-garbanzo/',
    reuseExistingServer: true,
  },
})
