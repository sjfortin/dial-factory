import test from 'node:test';
import { readFileSync } from 'node:fs';
import { exerciseDeliveredScript } from './ui-harness.js';

test('delivered browser bundle handles tool results and player controls', async () => {
  await exerciseDeliveredScript(readFileSync('dist/player.js', 'utf8'));
});
