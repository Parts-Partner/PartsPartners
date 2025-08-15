// src/lib/pricing.ts
export const calcDiscounted = (unit: number, pct: number) => unit * (1 - (pct || 0) / 100);