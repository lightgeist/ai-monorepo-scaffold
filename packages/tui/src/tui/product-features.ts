export interface TuiProductFeatures {
  readonly queue: boolean;
}

export const ATLASCODE_MVP_TUI_PRODUCT_FEATURES: TuiProductFeatures = Object.freeze({
  queue: true,
});

export function resolveTuiProductFeatures(
  overrides: Partial<TuiProductFeatures> | undefined,
): TuiProductFeatures {
  return {
    ...ATLASCODE_MVP_TUI_PRODUCT_FEATURES,
    ...overrides,
  };
}
