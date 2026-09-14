export function buildChromeLaunchConfig(env) {
  const config = {
    chromeFlags: ['--headless=new', '--no-first-run', '--no-default-browser-check', '--no-proxy-server'],
  }
  if (env.CHROME_PATH) {
    config.chromePath = env.CHROME_PATH
  }
  return config
}
