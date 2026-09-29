/** BrightLab product identity. Keep deployed addresses empty until a host is assigned. */
export const BRAND = Object.freeze({
  name: 'BrightLab',
  parent: 'BrightClass',
  version: '1.0.0',
  tagline: 'Explore how things work.',
  description: 'Interactive science and engineering explorations by BrightClass. Open models, follow flows and try experiments.',
  site: '',
  shortUrl: '',
})

/** Share only the exhibit, never debugging, recording or arbitrary input parameters. */
export function makeShareUrl(exhibit: string, pageUrl: string, site: string = BRAND.site): string {
  const url = new URL(site || pageUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('BrightLab sharing requires an HTTP(S) page')
  url.search = ''
  url.hash = ''
  url.searchParams.set('ex', exhibit)
  return url.href
}
