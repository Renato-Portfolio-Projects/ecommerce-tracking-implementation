/**
 * Colour maths for the tests: reads the colours written in OKLCH in src/styles/tokens.css and works out
 * the WCAG 2.x contrast ratio between two of them. OKLCH is converted with the standard OKLab matrices.
 */

export interface Oklch {
  /** Lightness from 0 to 1. */
  l: number;
  /** Chroma. */
  c: number;
  /** Hue in degrees. */
  h: number;
}

export function parseOklch(text: string): Oklch {
  const match = text.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!match) throw new Error(`Not an oklch colour: ${text}`);
  return { l: Number(match[1]) / 100, c: Number(match[2]), h: Number(match[3]) };
}

/** Every colour token in a stylesheet, as written: name (without the dashes) to `oklch(...)`. */
export function readColourTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of css.matchAll(/--([\w-]+):\s*(oklch\([^)]*\))\s*;/g)) tokens[match[1]] = match[2];
  return tokens;
}

function toLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const cubedL = l_ ** 3;
  const cubedM = m_ ** 3;
  const cubedS = s_ ** 3;
  return [
    4.0767416621 * cubedL - 3.3077115913 * cubedM + 0.2309699292 * cubedS,
    -1.2684380046 * cubedL + 2.6097574011 * cubedM - 0.3413193965 * cubedS,
    -0.0041960863 * cubedL - 0.7034186147 * cubedM + 1.707614701 * cubedS,
  ];
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** The relative luminance WCAG defines, from 0 (black) to 1 (white). */
export function luminance(colour: Oklch): number {
  const [r, g, b] = toLinearSrgb(colour).map(clamp);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio between two colours, from 1 (none) to 21 (black on white). */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
