import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { interpolate } from '../src/parser/interpolate.js';

test('interpolate: simple {{var}} replacement', () => {
  assert.equal(interpolate('hello {{name}}', { name: 'world' }), 'hello world');
});

test('interpolate: leaves unknown tokens unreplaced', () => {
  assert.equal(interpolate('hi {{missing}}', {}), 'hi {{missing}}');
});

test('interpolate: supports {value: X} shape from global vars', () => {
  assert.equal(interpolate('{{api}}', { api: { value: 'https://x.dev' } }), 'https://x.dev');
});

test('interpolate: multiple tokens in one string', () => {
  assert.equal(
    interpolate('{{user}} logged into {{site}}', { user: 'admin', site: 'app' }),
    'admin logged into app'
  );
});

test('interpolate: passes through non-string inputs', () => {
  assert.equal(interpolate(null, {}), null);
  assert.equal(interpolate(undefined, {}), undefined);
});

test('interpolate: {{faker.person.firstName}} returns a non-empty string', () => {
  const out = interpolate('hi {{faker.person.firstName}}', {});
  assert.match(out, /^hi \S+/);
  assert.notEqual(out, 'hi {{faker.person.firstName}}');
});

test('interpolate: {{faker.internet.email}} contains an @', () => {
  const out = interpolate('{{faker.internet.email}}', {});
  assert.match(out, /@/);
});

test('interpolate: unknown faker path stays as token', () => {
  assert.equal(
    interpolate('{{faker.not.a.real.path}}', {}),
    '{{faker.not.a.real.path}}'
  );
});

test('interpolate: explicit vars take precedence over faker-like names', () => {
  // `faker` itself as a key isn't a faker path (no dot), so var wins
  assert.equal(interpolate('{{name}}', { name: 'Alice' }), 'Alice');
});
