import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberPauseRequest } from '../dist/pause-request.js';
test('remounted pause request is remembered without storing media or unbounded IDs', () => {
  const data = new Map(); const store = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  assert.equal(rememberPauseRequest(store, 'request-one'), 'new');
  assert.equal(rememberPauseRequest(store, 'request-one'), 'seen', 'second app mount sees the first attempt');
  for (let i = 0; i < 40; i++) assert.equal(rememberPauseRequest(store, `request-${i}`), 'new');
  const saved = JSON.parse([...data.values()][0]);
  assert.equal(saved.length, 32);
  assert.equal(saved.includes('request-one'), false);
  assert.equal(rememberPauseRequest(store, 'request-39'), 'seen');
});
test('unsafe or unavailable session storage fails closed for automatic Pause', () => {
  assert.equal(rememberPauseRequest(undefined, 'request'), 'unavailable');
  assert.equal(rememberPauseRequest({ getItem() { throw new Error('blocked'); }, setItem() {} }, 'request'), 'unavailable');
  assert.equal(rememberPauseRequest({ getItem() { return null; }, setItem() { throw new Error('blocked'); } }, 'request'), 'unavailable');
  assert.equal(rememberPauseRequest({ getItem() { return null; }, setItem() {} }, 'bad/request'), 'unavailable');
});
