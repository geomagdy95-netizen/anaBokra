import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { careerPageIds, getCareerPage } from './career-pages';

describe('generated career page index', () => {
  it('lists exactly the JSON files in packages/content/careers/pages (run `pnpm gen:pages` when this fails)', () => {
    const dir = join(__dirname, '../../../../../packages/content/careers/pages');
    const onDisk = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
    expect(careerPageIds().sort()).toEqual(onDisk);
  });

  it('resolves a page by id', () => {
    expect(getCareerPage('software_engineer')?.depth).toBe('full');
    expect(getCareerPage('nope')).toBeUndefined();
  });
});
