import { defineConfig, devices } from '@playwright/test'

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  fullyParallel: false,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:8000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      dependencies: ['baseline'],
      testIgnore: /(?:baseline|showcase)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], headless: true },
    },
    {
      // The Stockfish-backed baseline owns the CPU while it captures the production state.
      // Running it before the other projects keeps its engine startup deterministic.
      name: 'baseline',
      testMatch: /baseline\.spec\.ts/,
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'], headless: true },
    },
    {
      name: 'showcase',
      dependencies: ['baseline'],
      testMatch: /showcase\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], headless: true, baseURL: 'http://127.0.0.1:4173' },
    },
  ],
  webServer: [
    ...(externalBaseURL
      ? []
      : [
          {
            command: 'npm run preview -- --host 127.0.0.1 --port 8000 --strictPort',
            url: 'http://127.0.0.1:8000',
            reuseExistingServer: false,
          },
        ]),
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173/showcase.html',
      reuseExistingServer: false,
    },
  ],
})
