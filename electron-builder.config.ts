import type { Configuration } from 'electron-builder'

export default {
  appId: 'com.bii.agent-harness',
  productName: 'BII Agent Harness',
  directories: { output: 'dist' },
  files: ['out/**/*'],
  extraResources: [
    { from: 'resources/claude-bin', to: 'claude-bin' },
  ],
  win: { target: 'nsis', icon: 'resources/icon.ico' },
  mac: { target: 'dmg', icon: 'resources/icon.icns', category: 'public.app-category.productivity' },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true },
} satisfies Configuration
