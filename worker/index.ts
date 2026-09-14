type AssetsEnvironment = {
  readonly ASSETS: Fetcher
}

const assetPathPattern = /(?:^\/assets(?:\/|$)|\/[^/]*\.[^/]+$)/

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (assetPathPattern.test(url.pathname)) {
      return env.ASSETS.fetch(request)
    }

    return env.ASSETS.fetch(new Request(new URL('/', url), request))
  },
} satisfies ExportedHandler<AssetsEnvironment>
