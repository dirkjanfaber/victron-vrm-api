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
const outDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'api-spec'))

// Matches `$ref: 'x'`, `$ref: "x"` and `$ref: x`
const REF_PATTERN = /\$ref:\s*['"]?([^'"\s#]*)/g

async function fetchText (url) {
  const response = await fetch(url)
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`)
  }
  return response.text()
}

async function main () {
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

    for (const match of text.matchAll(REF_PATTERN)) {
      // Local refs (`#/components/...`) leave an empty file part
      if (!match[1]) continue
      const refUrl = new URL(match[1], url).href
      if (!referrers.has(refUrl)) {
        referrers.set(refUrl, new Set())
        queue.push(refUrl)
      }
      referrers.get(refUrl).add(relativePath)
    }
  }

  // Rebuild from scratch so files dropped upstream show up as deletions
  fs.rmSync(outDir, { recursive: true, force: true })
  for (const [relativePath, text] of files) {
    const target = path.join(outDir, relativePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, text)
  }

  if (brokenRefs.length > 0) {
    const lines = brokenRefs.flatMap(url => [...referrers.get(url)].map(from => `${from} -> ${url}`))
    fs.writeFileSync(path.join(outDir, 'broken-refs.txt'), lines.sort().join('\n') + '\n')
  }

  console.log(`Wrote ${files.size} spec files to ${outDir}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
