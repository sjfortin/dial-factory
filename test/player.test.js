import test from 'node:test';
import assert from 'node:assert/strict';
import { installPlayer } from '../dist/player-controller.js';

class ElementDouble extends EventTarget {
  dataset = {};
  textContent = '';
  attributes = {};
  setAttribute(name, value) { this.attributes[name] = value; }
  fire(name) { this.dispatchEvent(new Event(name)); }
}

function setup() {
  const audio = new ElementDouble();
  const toggle = new ElementDouble();
  const status = new ElementDouble();
  audio.playCalls = 0;
  audio.pauseCalls = 0;
  audio.play = () => { audio.playCalls++; return Promise.resolve(); };
  audio.pause = () => { audio.pauseCalls++; audio.fire('pause'); };
  installPlayer(audio, toggle, status);
  return { audio, toggle, status };
}

test('Play, Pause while buffering, and resume use direct audio controls', () => {
  const { audio, toggle, status } = setup();
  toggle.fire('click');
  assert.equal(audio.playCalls, 1);
  assert.equal(status.dataset.state, 'buffering');
  assert.equal(toggle.textContent, 'Pause');
  toggle.fire('click');
  assert.equal(audio.pauseCalls, 1);
  assert.equal(status.dataset.state, 'paused');
  toggle.fire('click');
  audio.fire('playing');
  assert.equal(audio.playCalls, 2);
  assert.equal(status.dataset.state, 'playing');
  assert.equal(toggle.textContent, 'Pause');
  toggle.fire('click');
  assert.equal(status.dataset.state, 'paused');
});

test('play rejection and media error expose retryable errors', async () => {
  const { audio, toggle, status } = setup();
  audio.play = () => Promise.reject(new Error('blocked'));
  toggle.fire('click');
  await Promise.resolve();
  assert.equal(status.dataset.state, 'error');
  assert.equal(toggle.textContent, 'Play');

  audio.play = () => Promise.resolve();
  toggle.fire('click');
  audio.fire('error');
  assert.equal(status.dataset.state, 'error');
  assert.equal(toggle.textContent, 'Play');
  toggle.fire('click');
  audio.fire('playing');
  assert.equal(status.dataset.state, 'playing');
});

test('late rejection after Pause cannot overwrite paused state', async () => {
  const { audio, toggle, status } = setup();
  let rejectPlay;
  audio.play = () => new Promise((_, reject) => { rejectPlay = reject; });
  toggle.fire('click');
  toggle.fire('click');
  rejectPlay(new Error('late'));
  await Promise.resolve();
  assert.equal(status.dataset.state, 'paused');
});
