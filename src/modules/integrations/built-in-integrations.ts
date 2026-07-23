import type { AppIntegration, InsertionStrategy } from '../../shared/types/integrations'
import { DeclarativeIntegration, type DeclarativeIntegrationOptions } from './declarative-integration'

const keyboardFirst: InsertionStrategy = {
  preferredMode: 'keyboard',
  fallbackModes: ['accessibility', 'clipboard-safe', 'internal-editor']
}

export function createBuiltInIntegrations(): AppIntegration[] {
  return profiles.map((profile) => new DeclarativeIntegration({ ...profile, strategy: keyboardFirst }))
}

const profiles: readonly Omit<DeclarativeIntegrationOptions, 'strategy'>[] = [
  {
    id: 'gmail',
    windowTitles: ['gmail'],
    transformationPresetId: 'email'
  },
  {
    id: 'vscode',
    identifiers: ['com.microsoft.vscode', 'com.microsoft.vscodeinsiders'],
    names: ['visual studio code', 'code - insiders'],
    executables: ['code.exe', 'code - insiders.exe'],
    transformationPresetId: null
  },
  {
    id: 'jetbrains',
    identifiers: ['com.jetbrains.'],
    names: ['intellij idea', 'webstorm', 'pycharm', 'phpstorm', 'rider', 'clion', 'goland', 'rubymine', 'android studio'],
    executables: ['idea64.exe', 'webstorm64.exe', 'pycharm64.exe', 'phpstorm64.exe', 'rider64.exe', 'clion64.exe', 'goland64.exe', 'studio64.exe'],
    transformationPresetId: null
  },
  {
    id: 'telegram',
    identifiers: ['ru.keepcoder.telegram', 'org.telegram.desktop'],
    names: ['telegram'],
    executables: ['telegram.exe'],
    transformationPresetId: 'message'
  },
  {
    id: 'slack',
    identifiers: ['com.tinyspeck.slackmacgap'],
    names: ['slack'],
    executables: ['slack.exe'],
    transformationPresetId: 'message'
  },
  {
    id: 'discord',
    identifiers: ['com.hnc.discord'],
    names: ['discord'],
    executables: ['discord.exe'],
    transformationPresetId: 'message'
  },
  {
    id: 'teams',
    identifiers: ['com.microsoft.teams', 'com.microsoft.teams2'],
    names: ['microsoft teams', 'teams'],
    executables: ['ms-teams.exe', 'teams.exe'],
    transformationPresetId: 'message'
  },
  {
    id: 'mail',
    identifiers: ['com.apple.mail'],
    names: ['mail', 'почта'],
    transformationPresetId: 'email'
  },
  {
    id: 'outlook',
    identifiers: ['com.microsoft.outlook'],
    names: ['microsoft outlook', 'outlook'],
    executables: ['olk.exe', 'outlook.exe'],
    transformationPresetId: 'email'
  },
  {
    id: 'notion',
    identifiers: ['notion.id'],
    names: ['notion'],
    executables: ['notion.exe'],
    transformationPresetId: 'written-style'
  },
  {
    id: 'obsidian',
    identifiers: ['md.obsidian'],
    names: ['obsidian'],
    executables: ['obsidian.exe'],
    transformationPresetId: 'written-style'
  },
  {
    id: 'browser',
    identifiers: ['com.apple.safari', 'com.google.chrome', 'org.mozilla.firefox', 'com.microsoft.edgemac'],
    names: ['safari', 'google chrome', 'firefox', 'microsoft edge', 'brave browser', 'yandex'],
    executables: ['chrome.exe', 'firefox.exe', 'msedge.exe', 'brave.exe', 'browser.exe'],
    transformationPresetId: null
  },
  {
    id: 'text-editor',
    identifiers: ['com.apple.textedit', 'com.microsoft.word'],
    names: ['textedit', 'notepad', 'wordpad', 'microsoft word'],
    executables: ['notepad.exe', 'wordpad.exe', 'winword.exe'],
    transformationPresetId: 'written-style'
  }
]
