import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseRunlyContent, parseRunlyFile } from '../src/parser/fileParser.js';

function mkTmp() {
  return mkdtempSync(join(tmpdir(), 'runly-test-'));
}

test('parseRunlyContent: single block with metadata', () => {
  const content = `@name: Smoke test
@tags: critical, auth

open example.com
click login`;
  const tests = parseRunlyContent(content, 'inline');
  assert.equal(tests.length, 1);
  assert.equal(tests[0].name, 'Smoke test');
  assert.deepEqual(tests[0].tags, ['critical', 'auth']);
  assert.equal(tests[0].instructions.length, 2);
});

test('parseRunlyContent: --- separates multiple tests', () => {
  const content = `@name: one
open a.com
---
@name: two
open b.com`;
  const tests = parseRunlyContent(content, 'inline');
  assert.equal(tests.length, 2);
  assert.equal(tests[0].name, 'one');
  assert.equal(tests[1].name, 'two');
});

test('parseRunlyContent: comments and blank lines are ignored', () => {
  const content = `# This is a comment
@name: t

# another comment
open x.com
# mid comment
click button`;
  const tests = parseRunlyContent(content, 'inline');
  assert.equal(tests[0].instructions.length, 2);
  assert.equal(tests[0].instructions[0], 'open x.com');
});

test('@use: expands module instructions with vars substituted', () => {
  const dir = mkTmp();
  try {
    writeFileSync(
      join(dir, 'login.runly'),
      `@name: login
open site.com
type {{user}} in username
type {{pass}} in password`
    );
    writeFileSync(
      join(dir, 'main.runly'),
      `@name: main flow
@use login.runly with user=admin pass=secret
click continue`
    );
    const tests = parseRunlyFile(join(dir, 'main.runly'));
    assert.equal(tests.length, 1);
    const steps = tests[0].instructions;
    assert.ok(steps.includes('type admin in username'));
    assert.ok(steps.includes('type secret in password'));
    assert.ok(steps.includes('click continue'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('@use: cycle detection throws', () => {
  const dir = mkTmp();
  try {
    writeFileSync(join(dir, 'a.runly'), `@use b.runly\nopen x`);
    writeFileSync(join(dir, 'b.runly'), `@use a.runly\nclick y`);
    assert.throws(
      () => parseRunlyFile(join(dir, 'a.runly')),
      /cycle detected/i
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('@use: unresolvable path throws with location hint', () => {
  const dir = mkTmp();
  try {
    writeFileSync(
      join(dir, 'main.runly'),
      `@use does-not-exist.runly\nopen x`
    );
    assert.throws(
      () => parseRunlyFile(join(dir, 'main.runly')),
      /@use target not found/i
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('@use: quoted values in `with` clause are preserved with spaces', () => {
  const dir = mkTmp();
  try {
    writeFileSync(
      join(dir, 'mod.runly'),
      `type {{greeting}} in field`
    );
    writeFileSync(
      join(dir, 'main.runly'),
      `@use mod.runly with greeting="hello world"`
    );
    const tests = parseRunlyFile(join(dir, 'main.runly'));
    assert.ok(tests[0].instructions.includes('type hello world in field'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('@use: unresolved vars in module stay as {{tokens}} for runtime', () => {
  const dir = mkTmp();
  try {
    writeFileSync(
      join(dir, 'mod.runly'),
      `type {{user}} in field
type {{runtime_only}} in other`
    );
    writeFileSync(
      join(dir, 'main.runly'),
      `@use mod.runly with user=admin`
    );
    const tests = parseRunlyFile(join(dir, 'main.runly'));
    assert.ok(tests[0].instructions.includes('type admin in field'));
    assert.ok(tests[0].instructions.includes('type {{runtime_only}} in other'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('metadata: @tags, @timeout, @retry parse as intended types', () => {
  const content = `@name: t
@tags: a, b , c
@timeout: 45
@retry: 3
open x`;
  const tests = parseRunlyContent(content, 'inline');
  assert.deepEqual(tests[0].tags, ['a', 'b', 'c']);
  assert.equal(tests[0].timeout, 45);
  assert.equal(tests[0].retry, 3);
});
