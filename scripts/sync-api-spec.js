#!/usr/bin/env node
'use strict'

/**
 * Mirror the published VRM API OpenAPI spec, including every file it
 * references through relative $refs, into a local directory. Committing
 * the mirror lets `git diff` show exactly what changed upstream.
 *
 * Usage: node scripts/sync-api-spec.js [outDir]
 */

const fs = require('fs')
const path = require('path')

const ENTRY_URL = 'https://vrm-api-docs.victronenergy.com/docs/docs/openapi.yaml'
const BASE_URL = 'https://vrm-api-docs.victronenergy.com/docs/'
const FETCH_TIMEOUT_MS = 30000

// Matches the file part of `$ref: x`, `"$ref": "x"` and `{$ref: x}`; stops
// at a fragment, quote, whitespace or flow-collection delimiter
const REF_PATTERN = /['"]?\$ref['"]?\s*:\s*['"]?([^'"\s#,{}[\]]*)/g

function extractRefs (text) {
  // Refs within the same file (`#/components/...`) leave an empty file part
  return [...text.matchAll(REF_PATTERN)].map(match => match[1]).filter(Boolean)
}

function resolveRef (ref, fromUrl) {
  const url = new URL(ref, fromUrl)
  // A query string keeps its `../` through URL normalisation and would
  // otherwise end up in the file path
  url.search = ''
  url.hash = ''
  return url.href
}

function mirrorPath (outDir, relativePath) {
  const target = path.resolve(outDir, relativePath)
  if (!target.startsWith(outDir + path.sep)) {
    throw new Error(`Refusing to write outside ${outDir}: ${relativePath}`)
  }
  return target
}

// Rebuilds outDir from scratch so files dropped upstream show up as
// deletions. Everything is checked before anything is deleted.
function writeMirror (outDir, files) {
  if (path.basename(outDir) !== 'api-spec') {
    throw new Error(`Refusing to replace ${outDir}: the mirror directory must be named api-spec`)
  }
  const targets = [...files].map(([relativePath, text]) => [mirrorPath(outDir, relativePath), text])

  fs.rmSync(outDir, { recursive: true, force: true })
  for (const [target, text] of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, text)
  }
}

async function fetchText (url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`)
  }
  return response.text()
}

async function main () {
  const outDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'api-spec'))
  const queue = [ENTRY_URL]
  // Referenced URL -> files referencing it
  const referrers = new Map([[ENTRY_URL, new Set()]])
  const files = new Map()
  const brokenRefs = []

  while (queue.length > 0) {
    const url = queue.shift()
    // Upstream has a few $refs that climb one directory too high; the docs
    // site tolerates them, so record them rather than failing the sync
    const text = url.startsWith(BASE_URL) ? await fetchText(url) : null
    if (text === null) {
      if (url === ENTRY_URL) throw new Error(`${url}: not found`)
      brokenRefs.push(url)
      continue
    }
    const relativePath = url.slice(BASE_URL.length)
    files.set(relativePath, text)

    for (const ref of extractRefs(text)) {
      const refUrl = resolveRef(ref, url)
      if (!referrers.has(refUrl)) {
        referrers.set(refUrl, new Set())
        queue.push(refUrl)
      }
      referrers.get(refUrl).add(relativePath)
    }
  }

  const specFileCount = files.size
  if (brokenRefs.length > 0) {
    const lines = brokenRefs.flatMap(url => [...referrers.get(url)].map(from => `${from} -> ${url}`))
    files.set('broken-refs.txt', lines.sort().join('\n') + '\n')
  }
  writeMirror(outDir, files)

  console.log(`Wrote ${specFileCount} spec files to ${outDir}`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}

module.exports = { extractRefs, resolveRef, mirrorPath, writeMirror, BASE_URL }
