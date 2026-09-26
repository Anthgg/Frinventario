import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FULL_WORKSPACE (regla FF001): ninguna vista de módulo puede vivir dentro de
 * un contenedor centrado con max-width. Excepciones permitidas: login,
 * diálogos, textos de lectura y páginas de error (anchos < 600px).
 */

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function ruleBlock(css: string, selector: string): string {
  const index = css.indexOf(selector);
  expect(index, `selector ${selector} no encontrado`).toBeGreaterThanOrEqual(0);
  const start = css.indexOf('{', index);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

function cssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return cssFiles(fullPath);
    return entry.name.endsWith('.css') ? [fullPath] : [];
  });
}

describe('FULL_WORKSPACE', () => {
  it('PageShell no declara max-width global', () => {
    const css = read('src/components/layout/PageShell.module.css');

    expect(css).toContain('width: 100%');
    expect(css).toContain('max-width: none');
    expect(css).toContain('min-width: 0');
    expect(css).not.toMatch(/max-width:\s*[\d.]+(px|rem|em|ch|vw)/);
  });

  it('el contenido del workspace ocupa todo el ancho disponible', () => {
    const css = read('src/components/layout/AppLayout.module.css');
    const block = ruleBlock(css, '.content {');

    expect(block).toContain('width: 100%');
    expect(block).toContain('max-width: none');
    expect(block).toContain('min-width: 0');
    expect(block).not.toMatch(/max-width:\s*[\d.]+(px|rem|em|ch|vw)/);
    expect(block).not.toMatch(/margin:\s*0 auto/);
  });

  it('ninguna hoja de estilos impone un contenedor de página centrado', () => {
    const violations: string[] = [];

    for (const file of cssFiles(resolve(process.cwd(), 'src'))) {
      const raw = readFileSync(file, 'utf8');
      // Los "@media (max-width: ...)" son breakpoints, no contenedores.
      const css = raw.replace(/@media[^{]*\{/g, '');
      const matches = css.match(/max-width:\s*([\d.]+)(px|rem|em|ch|vw)/g) ?? [];
      for (const match of matches) {
        const value = Number.parseFloat(match.replace(/max-width:\s*/, ''));
        const unit = match.match(/(px|rem|em|ch|vw)$/)?.[1];
        const pixels = unit === 'px' ? value : unit === 'ch' ? value * 8 : value * 16;
        if (pixels >= 600) {
          violations.push(`${file}: ${match}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
