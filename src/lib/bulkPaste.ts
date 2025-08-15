// src/lib/bulkPaste.ts
export interface PasteLine { sku: string; qty: number }

export function parseBulkPaste(text: string): PasteLine[] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      // supports "sku, qty" or "sku qty" or "qty, sku"
      const cells = l.split(/[\s,;\t]+/).filter(Boolean);
      if (cells.length === 1) return { sku: cells[0], qty: 1 };
      // try to detect which token is qty
      const n1 = Number(cells[0]); const n2 = Number(cells[1]);
      if (!Number.isNaN(n1) && n1>0) return { sku: cells[1], qty: Math.max(1, Math.floor(n1)) };
      if (!Number.isNaN(n2) && n2>0) return { sku: cells[0], qty: Math.max(1, Math.floor(n2)) };
      return { sku: cells[0], qty: 1 };
    });
}
