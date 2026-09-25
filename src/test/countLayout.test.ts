import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const countStyles = readFileSync(
  resolve(process.cwd(), 'src/features/conteo/CountSessionPage.module.css'),
  'utf8',
);

describe('mobile count layout', () => {
  it('keeps the register action clear of the fixed bottom navigation', () => {
    const mobileRules = countStyles.match(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/)?.[1];

    expect(mobileRules).toContain('.cameraZone {\n    margin-bottom: var(--sp-2);');
    expect(mobileRules).toContain('.currentCard {\n    position: relative;\n    gap: var(--sp-3);');
  });
});
