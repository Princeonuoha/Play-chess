interface ChromeLaunchConfig {
  chromePath?: string
  chromeFlags: string[]
}

interface LaunchEnvironment {
  CHROME_PATH?: string
}

export function buildChromeLaunchConfig(env: LaunchEnvironment): ChromeLaunchConfig {
  const config: ChromeLaunchConfig = {
    chromeFlags: ['--headless=new', '--no-first-run', '--no-default-browser-check', '--no-proxy-server'],
  }
  if (env.CHROME_PATH) {
    config.chromePath = env.CHROME_PATH
  }
  return config
}
