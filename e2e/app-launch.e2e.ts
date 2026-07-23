import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

test('launches hardened settings UI and exposes only the typed preload surface', async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'cure-voicer-e2e-'))
  const application = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      CURE_VOICER_E2E: '1',
      CURE_VOICER_SMOKE_USER_DATA: userData
    }
  })
  try {
    await application.firstWindow()
    await expect
      .poll(() => application.windows().some((candidate) => candidate.url().includes('/index.html')))
      .toBe(true)
    const page = application.windows().find((candidate) => candidate.url().includes('/index.html'))
    if (!page) throw new Error('Settings window was not created')
    await expect(page).toHaveTitle('Cure Voicer')
    await expect(page.locator('.sidebar-brand img')).toHaveAttribute(
      'src',
      /cure-voicer-keycap-c-logo-v3/
    )
    const security = await page.evaluate(() => ({
      requireType: typeof Reflect.get(window, 'require'),
      processType: typeof Reflect.get(window, 'process'),
      diagnosticType: typeof window.cureVoicer?.getDiagnosticReport,
      rawSendType: typeof Reflect.get(window.cureVoicer ?? {}, 'send'),
      rawInvokeType: typeof Reflect.get(window.cureVoicer ?? {}, 'invoke')
    }))
    expect(security.requireType).toBe('undefined')
    expect(security.processType).toBe('undefined')
    expect(security.rawSendType).toBe('undefined')
    expect(security.rawInvokeType).toBe('undefined')
    expect(security.diagnosticType).toBe('function')

    await expect(page.locator('#onboarding')).toBeVisible()
    await page.locator('#onboarding').evaluate((element) => {
      ;(element as HTMLElement).hidden = true
    })
    await page.getByRole('button', { name: 'Диагностика' }).click()
    await expect(page.getByText('Защищённое хранилище')).toBeVisible()
    await expect(page.getByText('Диагностика не включает распознанный текст')).toBeVisible()

    await page.getByRole('button', { name: 'Словарь' }).click()
    await expect(page.locator('#vocabularyReactRoot input')).toBeVisible()
    await page.getByRole('button', { name: 'История' }).click()
    await expect(page.locator('#historyReactRoot .history-empty')).toBeVisible()

    await page.getByRole('button', { name: 'Буфер и данные' }).click()
    const preferenceSelects = page.locator('#clipboardReactRoot select')
    await preferenceSelects.nth(1).selectOption('dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await preferenceSelects.nth(2).selectOption('en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.getByRole('button', { name: 'History' }).click()
    await expect(page.getByText('History is empty')).toBeVisible()
    await page.getByRole('button', { name: 'Models' }).click()
    await expect(page.getByText('Active model')).toBeVisible()
    await expect(page.getByText('Text correction')).toBeVisible()
    await page.getByRole('button', { name: 'General' }).click()
    await expect(page.locator('#generalReactRoot').getByText('Quick access')).toBeVisible()
    await expect(page.locator('#generalReactRoot').getByText('Insertion method')).toBeVisible()
    await page.getByRole('button', { name: 'Dictation' }).click()
    await expect(page.locator('#dictationReactRoot').getByText('Floating indicator')).toBeVisible()
    await expect(page.locator('#dictationReactRoot').getByText('Screen position')).toBeVisible()
    await page.getByRole('button', { name: 'Voice commands' }).click()
    await expect(page.locator('#commandsReactRoot').getByText('Cancel', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Editor' }).click()
    await expect(page.locator('#editorReactRoot').getByRole('button', { name: 'Process' })).toBeVisible()
    await page.getByRole('button', { name: 'Keyboard shortcuts' }).click()
    await expect(page.locator('#hotkeysReactRoot').getByText('Process selected text')).toBeVisible()
    await page.getByRole('button', { name: 'Integrations' }).click()
    await expect(page.locator('#integrationsReactRoot').getByText('Do not insert').first()).toBeVisible()
    await page.getByRole('button', { name: 'Templates' }).click()
    await expect(page.locator('#templatesReactRoot').getByPlaceholder('Name')).toBeVisible()
    await page.getByRole('button', { name: 'Clipboard and data' }).click()
    await expect(page.locator('#clipboardReactRoot').getByText('Save dictation history')).toBeVisible()
    await page.getByRole('button', { name: 'Diagnostics' }).click()
    await expect(page.locator('#diagnosticsReactRoot').getByText('Version', { exact: true })).toBeVisible()
  } finally {
    await application.evaluate(({ app }) => app.exit(0)).catch(() => undefined)
    await application.close().catch(() => undefined)
    await rm(userData, { recursive: true, force: true })
  }
})
