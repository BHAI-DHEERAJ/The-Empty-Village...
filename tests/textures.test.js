import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { SURFACES, suffixesFor } from '../src/game/world/surfaceCatalog.js';

const root = new URL('../src/assets/textures/', import.meta.url);

test('each surface uses local image files, with the expected image-data maps', () => {
  const catalog = new Set();
  for (const surface of Object.values(SURFACES)) {
    for (const suffix of suffixesFor(surface)) {
      const file = `${surface.file}-${suffix}.webp`;
      catalog.add(file);
      const bytes = readFileSync(new URL(file, root));
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', file);
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', file);
      assert.ok(bytes.length > 200, file);
    }
  }
  const files = readdirSync(root, { recursive: true }).filter((file) => file.endsWith('.webp'));
  assert.deepEqual(files.sort(), [...catalog].sort());
});
