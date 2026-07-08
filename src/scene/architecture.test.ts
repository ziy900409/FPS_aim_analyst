import { describe, expect, it } from 'vitest';

const sourceModules = {
  ...import.meta.glob<string>('../sim/**/*.ts', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('../state/**/*.ts', { query: '?raw', import: 'default', eager: true }),
};

describe('scene architecture boundary', () => {
  it('src/sim 與 src/state 不得 import src/scene', () => {
    const forbiddenImport = /\bfrom\s+['"](?:\.\.\/scene|\.\/scene)(?:\/[^'"]*)?['"]/;
    const violations = Object.entries(sourceModules)
      .filter(([, source]) => forbiddenImport.test(source))
      .map(([path]) => path);

    expect(violations).toEqual([]);
  });
});
