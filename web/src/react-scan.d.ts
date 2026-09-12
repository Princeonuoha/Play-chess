declare global {
  interface Window {
    __reactScanRenders?: Array<{
      readonly unnecessary: boolean | null
      readonly componentName: string | null
      readonly didCommit: boolean
      readonly changes: readonly unknown[]
    }>
    __reactScanFlowStart?: number
  }
}

export {}
