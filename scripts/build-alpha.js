#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const ALPHA_COLOR = '#4a90e2' // Blue
const ORIGINAL_COLOR = '#f7ab3e' // Orange

// Paths
const rootDir = path.join(__dirname, '..')
const buildDir = path.join(rootDir, 'build-alpha')
const packageJsonPath = path.join(rootDir, 'package.json')

console.log('Building alpha package...\n')

// 1. Read current package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const currentVersion = packageJson.version

// 2. Calculate alpha version
const alphaVersion = calculateAlphaVersion(currentVersion)
console.log(`Current version: ${currentVersion}`)
console.log(`Alpha version: ${alphaVersion}\n`)

// 3. Clean and create build directory
if (fs.existsSync(buildDir)) {
  console.log('Cleaning existing build directory...')
  fs.rmSync(buildDir, { recursive: true, force: true })
}
fs.mkdirSync(buildDir, { recursive: true })

// 4. Copy files
console.log('Copying files...')
const filesToCopy = [
  'src',
  'examples',
  'LICENSE',
  'README.md',
  'index.js'
]

filesToCopy.forEach(file => {
  const source = path.join(rootDir, file)
  const dest = path.join(buildDir, file)

  if (fs.existsSync(source)) {
    copyRecursive(source, dest)
  }
})

// 5. Create modified package.json
console.log('Creating alpha package.json...')
const alphaPackageJson = {
  ...packageJson,
  name: 'victron-vrm-api-alpha',
  version: alphaVersion,
  description: `${packageJson.description} (Alpha Testing Version)`,
  'node-red': {
    nodes: {
      'config-vrm-api-alpha': './src/nodes/config-vrm-api.js',
      'vrm-api-alpha': './src/nodes/vrm-api.js'
    },
    version: packageJson['node-red'].version
  }
}

fs.writeFileSync(
  path.join(buildDir, 'package.json'),
  JSON.stringify(alphaPackageJson, null, 2)
)

// 6. Modify HTML files (node registrations, labels, colors)
console.log('Modifying node registrations...')

// Modify config-vrm-api.html
const configHtmlPath = path.join(buildDir, 'src/nodes/config-vrm-api.html')
let configHtml = fs.readFileSync(configHtmlPath, 'utf8')
configHtml = configHtml.replace(
  /RED\.nodes\.registerType\('config-vrm-api'/g,
  "RED.nodes.registerType('config-vrm-api-alpha'"
)
configHtml = configHtml.replace(
  /data-template-name="config-vrm-api"/g,
  'data-template-name="config-vrm-api-alpha"'
)
configHtml = configHtml.replace(
  /return this\.name \|\| 'VRM API';/g,
  "return this.name || 'VRM API Alpha Config';"
)
fs.writeFileSync(configHtmlPath, configHtml)

// Modify vrm-api.html
const vrmHtmlPath = path.join(buildDir, 'src/nodes/vrm-api.html')
let vrmHtml = fs.readFileSync(vrmHtmlPath, 'utf8')
vrmHtml = vrmHtml.replace(
  /RED\.nodes\.registerType\('vrm-api'/g,
  "RED.nodes.registerType('vrm-api-alpha'"
)
vrmHtml = vrmHtml.replace(
  /data-template-name="vrm-api"/g,
  'data-template-name="vrm-api-alpha"'
)
vrmHtml = vrmHtml.replace(
  /data-help-name="vrm-api"/g,
  'data-help-name="vrm-api-alpha"'
)
vrmHtml = vrmHtml.replace(
  /category: 'Victron Energy'/g,
  "category: 'Victron Energy Alpha'"
)
vrmHtml = vrmHtml.replace(
  /paletteLabel: 'VRM API'/g,
  "paletteLabel: 'VRM API Alpha'"
)
vrmHtml = vrmHtml.replace(
  new RegExp(ORIGINAL_COLOR, 'g'),
  ALPHA_COLOR
)
vrmHtml = vrmHtml.replace(
  /type: "config-vrm-api"/g,
  'type: "config-vrm-api-alpha"'
)
fs.writeFileSync(vrmHtmlPath, vrmHtml)

// 7. Modify JS files (node registrations)
console.log('Modifying node implementations...')

// Modify config-vrm-api.js
const configJsPath = path.join(buildDir, 'src/nodes/config-vrm-api.js')
let configJs = fs.readFileSync(configJsPath, 'utf8')
configJs = configJs.replace(
  /RED\.nodes\.registerType\('config-vrm-api'/g,
  "RED.nodes.registerType('config-vrm-api-alpha'"
)
fs.writeFileSync(configJsPath, configJs)

// Modify vrm-api.js
const vrmJsPath = path.join(buildDir, 'src/nodes/vrm-api.js')
let vrmJs = fs.readFileSync(vrmJsPath, 'utf8')
vrmJs = vrmJs.replace(
  /RED\.nodes\.registerType\('vrm-api'/g,
  "RED.nodes.registerType('vrm-api-alpha'"
)
fs.writeFileSync(vrmJsPath, vrmJs)

// 8. Modify example files (node type references)
console.log('Modifying example flows...')
const examplesDir = path.join(buildDir, 'examples')
if (fs.existsSync(examplesDir)) {
  const exampleFiles = fs.readdirSync(examplesDir).filter(f => f.endsWith('.json'))

  exampleFiles.forEach(file => {
    const examplePath = path.join(examplesDir, file)
    let exampleContent = fs.readFileSync(examplePath, 'utf8')

    exampleContent = exampleContent.replace(
      /"type":\s*"vrm-api"/g,
      '"type": "vrm-api-alpha"'
    )
    exampleContent = exampleContent.replace(
      /"type":\s*"config-vrm-api"/g,
      '"type": "config-vrm-api-alpha"'
    )

    fs.writeFileSync(examplePath, exampleContent)
  })

  console.log(`  Updated ${exampleFiles.length} example file(s)`)
}

console.log('\n✓ Alpha package built successfully!')
console.log(`✓ Build directory: ${buildDir}`)
console.log('✓ Package name: victron-vrm-api-alpha')
console.log(`✓ Version: ${alphaVersion}`)
console.log('\nTo publish, run:')
console.log('  npm run publish:alpha')

/**
 * Calculate the next alpha version
 * - If version already has -alpha.X, increment X
 * - Otherwise, add -alpha.1
 */
function calculateAlphaVersion (version) {
  const alphaMatch = version.match(/^(.+)-alpha\.(\d+)$/)

  if (alphaMatch) {
    // Already an alpha version, increment the counter
    const baseVersion = alphaMatch[1]
    const alphaCounter = parseInt(alphaMatch[2], 10)
    return `${baseVersion}-alpha.${alphaCounter + 1}`
  } else {
    // Not an alpha version, add -alpha.1
    return `${version}-alpha.1`
  }
}

/**
 * Recursively copy files/directories
 */
function copyRecursive (src, dest) {
  const stat = fs.statSync(src)

  if (stat.isDirectory()) {
    // Create directory
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }

    // Copy contents
    const entries = fs.readdirSync(src)
    entries.forEach(entry => {
      copyRecursive(
        path.join(src, entry),
        path.join(dest, entry)
      )
    })
  } else {
    // Copy file
    fs.copyFileSync(src, dest)
  }
}
