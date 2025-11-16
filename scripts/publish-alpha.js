#!/usr/bin/env node
'use strict'

const { execSync } = require('child_process')
const path = require('path')

const rootDir = path.join(__dirname, '..')
const buildDir = path.join(rootDir, 'build-alpha')

console.log('Publishing alpha package...\n')

try {
  // 1. Build the alpha package
  console.log('Step 1: Building alpha package...')
  execSync('node scripts/build-alpha.js', {
    cwd: rootDir,
    stdio: 'inherit'
  })

  // 2. Publish from build directory
  console.log('\nStep 2: Publishing to npm...')
  execSync('npm publish', {
    cwd: buildDir,
    stdio: 'inherit'
  })

  console.log('\n✓ Alpha package published successfully!')
  console.log('\nUsers can install with:')
  console.log('  npm install victron-vrm-api-alpha')
} catch (error) {
  console.error('\n✗ Error during publish:', error.message)
  process.exit(1)
}
