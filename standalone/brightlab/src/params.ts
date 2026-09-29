/** Untrusted share-link inputs must never create NaNs, invalid states or runaway render sizes. */
export function sanitizeParams(search: string, shots: readonly string[] = []): URLSearchParams {
  const input = new URLSearchParams(search)
  const out = new URLSearchParams()
  const enums: Record<string, readonly string[]> = {
    ex: ['hall','fusion','engine','pump','line','car','motor','robot','hole','jet','f1','drone'],
    q: ['low','mid','high'], rec: ['1'], fixed: ['1'], clean: ['1'], debug: ['1'],
    view: ['whole','cut','exploded'], fview: ['whole','cut','exploded'], mview: ['whole','cut','exploded'],
    cview: ['whole','xray','exploded'], follow: ['all','oxygen','methane','fire'],
    ffollow: ['all','plasma','magnets','neutrons','power'], cfollow: ['all','energy','motors','structure'],
    mfollow: ['all','current','field','gears'], cmode: ['cruise','launch','regen','steer'], mmode: ['drive','regen','coast'],
    shot: shots,
  }
  for (const [key, allowed] of Object.entries(enums)) {
    const value = input.get(key)
    if (value !== null && allowed.includes(value)) out.set(key, value)
  }
  const numeric: Record<string, readonly [number, number]> = {
    throttle: [.4,1], alt: [0,100], temp: [15,180], speed: [0,200], rpm: [0,16000],
    dpr: [.5,3], px: [300000,8300000], rs: [.5,2],
  }
  for (const [key, [min,max]] of Object.entries(numeric)) {
    const raw = input.get(key)
    if (raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw))) out.set(key, String(Math.max(min, Math.min(max, Number(raw)))))
  }
  return out
}
