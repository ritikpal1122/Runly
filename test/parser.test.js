import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parse } from '../src/parser/index.js';

test('parse: goto url', () => {
  const steps = parse('open example.com');
  assert.equal(steps.length, 1);
  assert.equal(steps[0].action, 'goto');
  assert.equal(steps[0].url, 'https://example.com');
});

test('parse: click with description', () => {
  const steps = parse('click login button');
  assert.equal(steps[0].action, 'click');
});

test('parse: type value in field', () => {
  const steps = parse('type admin in username');
  assert.equal(steps[0].action, 'type');
  assert.equal(steps[0].value, 'admin');
});

test('parse: search expands to type + press Enter', () => {
  const steps = parse('search playwright');
  assert.equal(steps.length, 2);
  assert.equal(steps[0].action, 'type');
  assert.equal(steps[1].action, 'press');
  assert.equal(steps[1].key, 'Enter');
});

test('parse: chained "and" produces multiple steps', () => {
  const steps = parse('open example.com and click login');
  assert.ok(steps.length >= 2);
  assert.equal(steps[0].action, 'goto');
});

test('parse: verify ai: routes to ai-assert action', () => {
  const steps = parse('verify ai: the cart total equals the sum of items');
  assert.equal(steps.length, 1);
  assert.equal(steps[0].action, 'ai-assert');
  assert.equal(steps[0].assertion, 'the cart total equals the sum of items');
});

test('parse: assert ai: also routes to ai-assert', () => {
  const steps = parse('assert ai: a welcome banner is visible');
  assert.equal(steps[0].action, 'ai-assert');
});

test('parse: check ai: / ensure ai: / confirm ai: all route to ai-assert', () => {
  for (const verb of ['check', 'ensure', 'confirm']) {
    const steps = parse(`${verb} ai: something is visible`);
    assert.equal(steps[0].action, 'ai-assert', `${verb} ai: should route`);
  }
});

test('parse: plain "verify X is visible" stays a normal assert', () => {
  const steps = parse('verify dashboard is visible');
  assert.equal(steps[0].action, 'assert');
});

test('parse: empty / whitespace / non-string input → []', () => {
  assert.deepEqual(parse(''), []);
  assert.deepEqual(parse('   '), []);
  assert.deepEqual(parse(null), []);
  assert.deepEqual(parse(undefined), []);
});

test('parse: press Enter', () => {
  const steps = parse('press Enter');
  assert.equal(steps[0].action, 'press');
  assert.equal(steps[0].key, 'Enter');
});

test('parse: wait duration', () => {
  const steps = parse('wait 3 seconds');
  assert.equal(steps[0].action, 'wait');
  assert.ok(steps[0].duration > 0);
});

test('parse: screenshot', () => {
  const steps = parse('screenshot');
  assert.equal(steps[0].action, 'screenshot');
});

test('parse: back / forward / reload produce matching actions', () => {
  const back = parse('back');
  const forward = parse('forward');
  const reload = parse('reload');
  assert.ok(back.some((s) => s.action === 'back'));
  assert.ok(forward.some((s) => s.action === 'forward'));
  assert.ok(reload.some((s) => s.action === 'reload'));
});
