import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * BLIND-SAFE (FF003): la vista de conteo jamás pide ni traduce campos
 * protegidos del contrato administrativo (esperado, costos, margen).
 */

const CONTEO_DIR = resolve(process.cwd(), 'src/features/conteo');
const API_FILE = resolve(process.cwd(), 'src/api/counting.ts');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

const FORBIDDEN = [
  'expected_quantity',
  'sale_price',
  'cost_snapshot',
  'effective_cost',
  'consignment_cost',
  'supplier_reference',
  'is_extra',
  'margin',
  'profit',
];

describe('modo ciego en la sesión de conteo', () => {
  const files = [...sourceFiles(CONTEO_DIR), API_FILE];

  it('revisa todos los archivos del módulo de conteo', () => {
    expect(files.length).toBeGreaterThan(6);
  });

  it('no menciona campos protegidos del contrato administrativo', () => {
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const field of FORBIDDEN) {
        if (content.toLowerCase().includes(field)) violations.push(`${file}: ${field}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('no depende de datos simulados (sin UI_MOCK ni mock/data)', () => {
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (content.includes('UI_MOCK')) violations.push(`${file}: UI_MOCK`);
      if (content.includes('mock/data')) violations.push(`${file}: mock/data`);
      if (content.includes('RECENT_PRODUCTS')) violations.push(`${file}: RECENT_PRODUCTS`);
    }

    expect(violations).toEqual([]);
  });

  it('la cámara solo se consulta por getUserMedia (ningún frame sale del navegador)', () => {
    const content = files.map((file) => readFileSync(file, 'utf8')).join('\n');

    expect(content).toContain('getUserMedia');
    expect(content).not.toMatch(/\bfetch\s*\(\s*.*(canvas|frame|image)/i);
    expect(content).not.toContain('multipart/form-data');
  });
});
