export interface ChromeLaunchConfig {
  chromePath?: string
  chromeFlags: string[]
}

export interface LaunchEnvironment {
  CHROME_PATH?: string
}

export function buildChromeLaunchConfig(env: LaunchEnvironment): ChromeLaunchConfig
