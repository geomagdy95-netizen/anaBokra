import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import manifest from './manifest.json';
import { artGroup, artUrl, discoverArt, pathArt } from './task-art';

describe('task art', () => {
  it('looks from the question to the task to the island', () => {
    expect(pathArt('health', 'day', 'health_day_1')).toEqual(['tasks/health/health_day_1', 'tasks/health/day', 'tasks/health/cover']);
    expect(pathArt('health')).toEqual(['tasks/health/cover']);
    expect(discoverArt(3)).toEqual(['tasks/discover/task_3', 'tasks/discover/cover']);
    expect(artGroup(pathArt('law', 'try'))).toBe('law');
    expect(artGroup(discoverArt())).toBe('discover');
  });

  it('only gives URLs for pictures in the manifest', () => {
    expect(artUrl(['tasks/none/missing'])).toBeNull();
    expect(artUrl(undefined)).toBeNull();
    for (const [key, hash] of Object.entries(manifest.files as Record<string, string>)) expect(artUrl(['tasks/none/missing', key])).toBe(`/art/${key}.webp?v=${hash}`);
  });

  it('has a file in public/art for every manifest entry', () => {
    for (const key of Object.keys(manifest.files)) expect(fs.existsSync(path.join(process.cwd(), 'public/art', `${key}.webp`)), key).toBe(true);
  });
});
