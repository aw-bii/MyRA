import { execSync } from 'child_process'
import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { platform } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resourcesDir = join(__dirname, '..', 'resources', 'claude-bin')

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

async function main() {
  ensureDir(resourcesDir)

  const whichCmd = platform() === 'win32' ? 'where claude' : 'which claude'
  try {
    const claudePath = execSync(whichCmd, { encoding: 'utf8' }).trim().split('\n')[0]
    console.log(`Found Claude at: ${claudePath}`)
    const dest = join(resourcesDir, platform() === 'win32' ? 'claude.exe' : 'claude')
    copyFileSync(claudePath, dest)
    if (platform() !== 'win32') {
      execSync(`chmod +x "${dest}"`)
    }
    console.log(`Claude binary bundled to: ${dest}`)
  } catch {
    console.log('Claude not found globally, installing to temp...')
    const tmpDir = join(resourcesDir, '..', '.claude-tmp')
    ensureDir(tmpDir)
    execSync(`npm init -y`, { cwd: tmpDir, stdio: 'pipe' })
    execSync(`npm install @anthropic-ai/claude-code`, { cwd: tmpDir, stdio: 'pipe' })
    const binaryName = platform() === 'win32' ? 'claude.exe' : 'claude'
    const nodeModulesBin = join(tmpDir, 'node_modules', '.bin', binaryName)
    if (existsSync(nodeModulesBin)) {
      copyFileSync(nodeModulesBin, join(resourcesDir, binaryName))
      console.log(`Claude binary downloaded and bundled to: ${resourcesDir}`)
    } else {
      console.error('Could not find downloaded Claude binary')
      process.exit(1)
    }
    // Cleanup
    execSync(`rm -rf "${tmpDir}"`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
