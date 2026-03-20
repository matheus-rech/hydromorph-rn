/**
 * E2E Smoke Test — Web Deployment Validation
 *
 * Runs `npx expo export --platform web` and validates the output:
 *   1. Build completes without errors
 *   2. dist/index.html exists and contains expected content
 *   3. JS bundle is generated under dist/_expo/static/js/
 *   4. Asset files (thumbnails, navigation icons) are exported
 *   5. Serves locally and returns HTTP 200 on index.html
 *
 * Usage:  node e2e/smoke-web.mjs
 * Exit 0 on success, non-zero on failure.
 *
 * Author: Matheus Machado Rech
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const DIST = join(ROOT, 'dist');

let failures = 0;

function pass(msg) {
  console.log(`  ✅ ${msg}`);
}

function fail(msg) {
  console.error(`  ❌ ${msg}`);
  failures++;
}

function check(condition, passMsg, failMsg) {
  if (condition) {
    pass(passMsg);
  } else {
    fail(failMsg);
  }
}

// ── Step 1: Build ────────────────────────────────────────────────────────────

console.log('\n🔨 Step 1: Building web export…');
try {
  execSync('npx expo export --platform web', {
    cwd: ROOT,
    stdio: 'pipe',
    timeout: 120_000,
  });
  pass('expo export completed without errors');
} catch (err) {
  fail(`expo export failed: ${err.stderr?.toString().slice(-500) || err.message}`);
  process.exit(1);
}

// ── Step 2: Validate index.html ──────────────────────────────────────────────

console.log('\n📄 Step 2: Validating dist/index.html…');
const indexPath = join(DIST, 'index.html');
check(existsSync(indexPath), 'index.html exists', 'index.html missing');

if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, 'utf-8');
  check(
    html.includes('<div id="root">'),
    'index.html contains React root div',
    'index.html missing <div id="root">'
  );
  check(
    html.includes('.js'),
    'index.html references a JS bundle',
    'index.html does not reference any JS bundle'
  );
}

// ── Step 3: Validate JS bundle ───────────────────────────────────────────────

console.log('\n📦 Step 3: Validating JS bundle…');
const jsDir = join(DIST, '_expo', 'static', 'js', 'web');
check(existsSync(jsDir), 'JS directory exists: _expo/static/js/web/', `JS directory missing: ${jsDir}`);

if (existsSync(jsDir)) {
  const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith('.js'));
  check(jsFiles.length > 0, `Found ${jsFiles.length} JS bundle(s)`, 'No JS bundles found');

  if (jsFiles.length > 0) {
    const bundlePath = join(jsDir, jsFiles[0]);
    const bundleContent = readFileSync(bundlePath, 'utf-8');
    const bundleSize = Buffer.byteLength(bundleContent);
    check(
      bundleSize > 100_000,
      `Bundle size: ${(bundleSize / 1024).toFixed(0)} KB (reasonable)`,
      `Bundle suspiciously small: ${bundleSize} bytes`
    );

    // Check that key app modules are included
    check(
      bundleContent.includes('HydroMorph') || bundleContent.includes('hydromorph'),
      'Bundle contains app name reference',
      'Bundle does not contain app name — may be a stub'
    );
  }
}

// ── Step 4: Validate exported assets ─────────────────────────────────────────

console.log('\n🖼️  Step 4: Validating exported assets…');
const assetsDir = join(DIST, 'assets');
check(existsSync(assetsDir), 'assets/ directory exists', 'assets/ directory missing');

if (existsSync(assetsDir)) {
  const allAssets = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else allAssets.push(join(dir, entry.name));
    }
  }
  walk(assetsDir);
  check(allAssets.length >= 5, `Found ${allAssets.length} asset files`, `Only ${allAssets.length} asset files — expected ≥ 5`);

  // Check for sample image thumbnails
  const sampleImages = allAssets.filter((p) => p.includes('sample-images'));
  check(
    sampleImages.length >= 5,
    `Found ${sampleImages.length} sample thumbnail images`,
    `Only ${sampleImages.length} sample thumbnails — expected 5`
  );
}

// ── Step 5: HTTP serve test ──────────────────────────────────────────────────

console.log('\n🌐 Step 5: HTTP serve test…');
await new Promise((resolve) => {
  const server = createServer((req, res) => {
    const filePath = join(DIST, req.url === '/' ? 'index.html' : req.url);
    if (existsSync(filePath)) {
      res.writeHead(200);
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(0, '127.0.0.1', async () => {
    const port = server.address().port;
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/`);
      check(resp.status === 200, `GET / returned HTTP ${resp.status}`, `GET / returned HTTP ${resp.status}`);
      const body = await resp.text();
      check(body.includes('<div id="root">'), 'Served HTML contains React root', 'Served HTML missing React root');
    } catch (err) {
      fail(`HTTP serve test failed: ${err.message}`);
    } finally {
      server.close();
      resolve();
    }
  });
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
if (failures === 0) {
  console.log('🎉 All E2E smoke checks passed!');
  process.exit(0);
} else {
  console.log(`💥 ${failures} check(s) failed.`);
  process.exit(1);
}
