// Optional typefaces restored by scripts/fetch_fonts.py.

/**
 * CSS @font-face declaration for NotoSerif-Bold (bundled locally).
 * Use in components via: <style>{notoSerifFontFace}</style>
 */
export const NOTO_SERIF_FONT_FAMILY = "NotoSerif-Bold";

export const notoSerifFontFace = "";

/** Montserrat ExtraBold (bundled, SIL OFL): the "pill" hook style's sans. */
export const MONTSERRAT_FONT_FAMILY = "Montserrat-ExtraBold";

export const montserratFontFace = "";

/** Anton (bundled, SIL OFL): the condensed hook typeface. */
export const ANTON_FONT_FAMILY = "Anton-Regular";

export const antonFontFace = "";

/**
 * Hook typefaces: CSS family + share of the 90% box width used as font size.
 * Must mirror hooks.py HOOK_FONTS.
 */
export const HOOK_FONTS: Record<string, { family: string; weight: number; factor: number }> = {
  montserrat: { family: `'${MONTSERRAT_FONT_FAMILY}', 'Montserrat', sans-serif`, weight: 800, factor: 0.064 },
  anton: { family: `'${ANTON_FONT_FAMILY}', Impact, sans-serif`, weight: 400, factor: 0.08 },
  serif: { family: `'${NOTO_SERIF_FONT_FAMILY}', 'Noto Serif', Georgia, serif`, weight: 700, factor: 0.05 },
};

/**
 * Map of subtitle font families to their CSS-safe names.
 * These match the options available in SubtitleModal.jsx.
 */
export const SUBTITLE_FONTS: Record<string, string> = {
  Verdana: "Verdana, Geneva, sans-serif",
  Arial: "Arial, Helvetica, sans-serif",
  Impact: "Impact, Haettenschweiler, sans-serif",
  Helvetica: "Helvetica, Arial, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  "Courier New": "'Courier New', Courier, monospace",
  Anton: `'${ANTON_FONT_FAMILY}', Impact, sans-serif`,
  "Montserrat ExtraBold": `'${MONTSERRAT_FONT_FAMILY}', 'Montserrat', sans-serif`,
};

export function getFontStack(fontFamily: string): string {
  return SUBTITLE_FONTS[fontFamily] ?? fontFamily;
}
