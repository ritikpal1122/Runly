// ═══════════════════════════════════════════════════════════════════════════
// .RUNLY FILE FORMAT PARSER
// ═══════════════════════════════════════════════════════════════════════════
//
// Tests-as-code: tests live in your repo as .runly files that humans can read
// and git can diff.
//
// FORMAT:
//   # Comments start with #
//
//   @name: Test name                    (metadata)
//   @tags: auth, critical               (metadata, comma-separated)
//   @description: What this tests        (metadata)
//   @timeout: 30                        (optional, seconds)
//   @retry: 2                            (optional retry count)
//
//   open {{site_url}}                   (one instruction per line)
//   type {{user}} in username field
//   type {{pass}} in password field
//   click sign in button
//   verify dashboard is visible
//
// Multiple tests in one file are separated by ---
//
// Supports {{variable}} substitution from --vars, env, or .env file.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, basename, extname } from 'path';

// ── Parse a single .runly file ─────────────────────────────────────────────

export function parseRunlyFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Test file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf8');
  return parseRunlyContent(content, filePath);
}

// ── Parse content of a .runly file ─────────────────────────────────────────

export function parseRunlyContent(content, sourcePath = 'inline') {
  // Split into test blocks (separated by --- lines)
  const blocks = content
    .split(/^---+\s*$/gm)
    .map(b => b.trim())
    .filter(b => b.length > 0);

  const tests = blocks
    .map((block, i) => parseTestBlock(block, sourcePath, i))
    .filter(Boolean);

  return tests;
}

// ── Parse a single test block ──────────────────────────────────────────────

function parseTestBlock(block, sourcePath, index) {
  const lines = block.split('\n');
  const metadata = {};
  const instructions = [];

  for (let line of lines) {
    const raw = line;
    line = line.trim();

    // Skip empty lines
    if (!line) continue;

    // Skip comments
    if (line.startsWith('#')) continue;

    // Parse metadata (@key: value)
    const metaMatch = line.match(/^@([a-zA-Z_]+):\s*(.*)$/);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();

      if (key === 'tags') {
        metadata.tags = value.split(',').map(t => t.trim()).filter(Boolean);
      } else if (key === 'timeout' || key === 'retry') {
        metadata[key] = parseInt(value, 10);
      } else if (key === 'vars') {
        metadata.requiredVars = value.split(',').map(v => v.trim()).filter(Boolean);
      } else {
        metadata[key] = value;
      }
      continue;
    }

    // Otherwise it's an instruction line
    instructions.push(line);
  }

  if (instructions.length === 0) return null;

  // Combine instructions into a single chained command
  const combined = instructions.join(' and ');

  return {
    name: metadata.name || `${basename(sourcePath, extname(sourcePath))}#${index + 1}`,
    description: metadata.description || null,
    tags: metadata.tags || [],
    timeout: metadata.timeout || null,
    retry: metadata.retry || 0,
    requiredVars: metadata.requiredVars || [],
    instructions,
    combined,
    source: sourcePath,
    metadata,
  };
}

// ── Discover all .runly files in a directory (recursive) ───────────────────

export function discoverTestFiles(path) {
  if (!existsSync(path)) {
    throw new Error(`Path not found: ${path}`);
  }

  const stat = statSync(path);

  // Single file
  if (stat.isFile()) {
    if (!path.endsWith('.runly') && !path.endsWith('.runly.md')) {
      throw new Error(`Not a .runly file: ${path}`);
    }
    return [path];
  }

  // Directory — recursive discovery
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) {
        // Skip common ignore dirs
        if (entry === 'node_modules' || entry === '.git' || entry === 'output') continue;
        walk(full);
      } else if (entry.endsWith('.runly') || entry.endsWith('.runly.md')) {
        files.push(full);
      }
    }
  }
  walk(path);
  return files.sort();
}

// ── Load all tests from a path (file or directory) ────────────────────────

export function loadTests(path) {
  const files = discoverTestFiles(path);
  const allTests = [];
  for (const file of files) {
    try {
      const tests = parseRunlyFile(file);
      allTests.push(...tests);
    } catch (err) {
      console.error(`  ✗ Failed to parse ${file}: ${err.message}`);
    }
  }
  return allTests;
}

// ── Filter tests by tag ────────────────────────────────────────────────────

export function filterTests(tests, options = {}) {
  let filtered = tests;

  if (options.tag) {
    filtered = filtered.filter(t => t.tags.includes(options.tag));
  }

  if (options.name) {
    const regex = new RegExp(options.name, 'i');
    filtered = filtered.filter(t => regex.test(t.name));
  }

  if (options.grep) {
    const regex = new RegExp(options.grep, 'i');
    filtered = filtered.filter(t =>
      regex.test(t.name) || regex.test(t.combined) || t.tags.some(tag => regex.test(tag))
    );
  }

  return filtered;
}
