import { defineConfig, devices } from '@playwright/test'

const liteA = process.env.LITE_A_DIR ?? '.out/lite-head'
const liteB = process.env.LITE_B_DIR ?? '.out/lite-head'

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    viewport: { width: 1440, height: 3000 },
    timezoneId: 'UTC',
    locale: 'en-US',
    deviceScaleFactor: 1,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 3000 } } }],
  webServer: [
    {
      command: `node scripts/static-server.mjs ${liteA} 4301`,
      url: 'http://127.0.0.1:4301/',
      reuseExistingServer: false,
    },
    {
      command: `node scripts/static-server.mjs ${liteB} 4302`,
      url: 'http://127.0.0.1:4302/',
      reuseExistingServer: false,
    },
  ],
})
