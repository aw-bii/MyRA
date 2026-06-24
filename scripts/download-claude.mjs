import { execSync } from 'child_process'
import { existsSync, mkdirSync, copyFileSync, rmSync, createReadStream } from 'fs'
import { createHash } from 'node:crypto'
import { platform } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BINARY_NAME = platform() === 'win32' ? 'claude.exe' : 'claude'
const resourcesDir = join(__dirname, '..', 'resources', 'claude-bin')

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (d) => hash.update(d))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

async function main() {
  ensureDir(resourcesDir)

  const whichCmd = platform() === 'win32' ? 'where claude' : 'which claude'
  try {
    const claudePath = execSync(whichCmd, { encoding: 'utf8' }).trim().split('\n')[0]
    console.log(`Found Claude at: ${claudePath}`)
    const dest = join(resourcesDir, BINARY_NAME)
    copyFileSync(claudePath, dest)
    if (platform() !== 'win32') {
      execSync(`chmod +x "${dest}"`)
    }
    console.log(`Claude binary bundled to: ${dest}`)
    const sha256 = await computeSha256(dest)
    console.log(`SHA-256 of bundled Claude binary: ${sha256}`)
    console.log(`Record this hash in resources/claude-bin/claude.sha256 for audit purposes.`)
  } catch {
    console.log('Claude not found globally, installing to temp...')
    const tmpDir = join(resourcesDir, '..', 'claude-tmp')
    ensureDir(tmpDir)
    execSync(`npm init -y`, { cwd: tmpDir, stdio: 'pipe' })
    execSync(`npm install @anthropic-ai/claude-code`, { cwd: tmpDir, stdio: 'pipe' })
    const nodeModulesBin = join(tmpDir, 'node_modules', '.bin', BINARY_NAME)
    if (existsSync(nodeModulesBin)) {
      const dest = join(resourcesDir, BINARY_NAME)
      copyFileSync(nodeModulesBin, dest)
      console.log(`Claude binary downloaded and bundled to: ${resourcesDir}`)
      const sha256 = await computeSha256(dest)
      console.log(`SHA-256 of bundled Claude binary: ${sha256}`)
      console.log(`Record this hash in resources/claude-bin/claude.sha256 for audit purposes.`)
    } else {
      console.warn('Could not find downloaded Claude binary — skipping. Run this script manually before packaging.')
      process.exit(0)
    }
    // Cleanup
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

main().catch(err => { console.error(err); process.exit(1) })
