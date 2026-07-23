import { useSyncExternalStore } from 'react'
import type { AppPreferences, HoldKey, RecordingState } from '../../../shared/contracts'
import type { CoreSettingsController } from '../../app/core-settings-controller'
import { holdKeyGlyph } from '../../app/core-settings-controller'
import { useI18n } from '../../app/i18n/i18n-context'

export function GeneralSettingsPage({
  controller,
  logoUrl
}: {
  controller: CoreSettingsController
  logoUrl: string
}): React.JSX.Element {
  const { t, locale } = useI18n()
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const { preferences } = snapshot
  const update = (patch: Partial<AppPreferences>): void => { void controller.updatePreferences(patch) }
  const stateCopy = recordingCopy(snapshot.recordingState, preferences, snapshot.platform, locale)
  const detail = snapshot.recordingDetail || stateCopy.detail
  const disabled = snapshot.recordingState === 'starting' || snapshot.recordingState === 'transcribing'
  const holdLabel = formatHoldKey(preferences.holdKey, snapshot.platform, locale)

  return (
    <div className="general-settings-feature">
      <article className="status-card">
        <div className="mini-orb" aria-hidden="true"><img className="mini-brand-logo" src={logoUrl} alt="" draggable={false} /></div>
        <div className="status-copy">
          <strong>{stateCopy.label}</strong><p>{detail}</p>
          <div className="level-meter" aria-hidden="true">
            {Array.from({ length: 15 }, (_, index) => <span key={index} style={meterStyle(index, snapshot.audioLevel)} />)}
          </div>
        </div>
        <button className="test-button" type="button" disabled={disabled} onClick={() => void controller.toggleRecording()}>
          {snapshot.recordingState === 'recording' ? t('common.stopRecording') : t('general.test')}
        </button>
      </article>

      <div className="group-label">{t('general.quickAccess')}</div>
      <div className="settings-group">
        <SettingRow symbol="⚡" color="orange" title={t('general.activation')} detail={t('general.activationDetail')}>
          <div className="mode-segmented" role="group" aria-label={t('general.activation')}>
            <button type="button" aria-pressed={preferences.activationMode === 'hold'} onClick={() => update({ activationMode: 'hold' })}>{t('general.hold')}</button>
            <button type="button" aria-pressed={preferences.activationMode === 'toggle'} onClick={() => update({ activationMode: 'toggle' })}>{t('general.toggle')}</button>
          </div>
        </SettingRow>
        <SettingRow symbol="—" color="blue" title={t('general.holdKey')} detail={snapshot.holdKeyStatus || (preferences.activationMode === 'hold' ? snapshot.globalInputAvailable ? t('general.holdKeyHint') : t('general.accessibilityRequired') : t('general.holdOnly'))}>
          <button className={`key-capture-button${snapshot.holdKeyCaptureActive ? ' is-capturing' : ''}${!snapshot.globalInputAvailable ? ' needs-permission' : ''}`} type="button" disabled={preferences.activationMode !== 'hold'} onClick={() => void controller.beginHoldKeyCapture()}>
            <kbd>{snapshot.holdKeyCaptureActive ? '…' : holdKeyGlyph(preferences.holdKey, snapshot.platform)}</kbd><span>{snapshot.holdKeyCaptureActive ? t('general.pressKey') : holdLabel}</span>
          </button>
        </SettingRow>
        <SettingRow symbol="→" color="blue" title={t('general.hotkey')} detail={t('general.hotkeyDetail')}>
          <select className="compact-select" aria-label={t('general.hotkey')} value={preferences.accelerator} disabled={preferences.activationMode !== 'toggle'} onChange={(event) => update({ accelerator: event.target.value })}>
            {['CommandOrControl+Shift+Space', 'CommandOrControl+Option+Space', 'CommandOrControl+Shift+D'].map((value) => <option key={value} value={value}>{formatAccelerator(value, snapshot.platform)}</option>)}
          </select>
        </SettingRow>
        <SettingRow symbol="♫" color="cyan" title={t('general.microphone')} detail={t('general.microphoneDetail')}>
          <select className="compact-select device-select" aria-label={t('general.microphone')} value={preferences.microphoneId} onChange={(event) => update({ microphoneId: event.target.value })}>
            {snapshot.microphones.map((device) => <option key={device.id} value={device.id}>{device.id === '' ? t('general.systemMicrophone') : device.label}</option>)}
          </select>
        </SettingRow>
        <SettingRow symbol="→" color="purple" title={t('general.autoPaste')} detail={t('general.autoPasteDetail')}><Toggle checked={preferences.autoPaste} onChange={(value) => update({ autoPaste: value })} /></SettingRow>
        <SettingRow symbol="⇥" color="cyan" title={t('general.insertionMode')} detail={t('general.insertionModeDetail')}>
          <select className="compact-select" value={preferences.insertionMode} disabled={!preferences.autoPaste} onChange={(event) => update({ insertionMode: event.target.value as AppPreferences['insertionMode'] })}>
            <option value="keyboard">{t('general.insertionKeyboard')}</option><option value="accessibility">Accessibility API</option><option value="clipboard-safe">{t('general.insertionClipboardSafe')}</option><option value="clipboard-only">{t('general.insertionCopy')}</option><option value="internal-editor">{t('general.insertionEditor')}</option>
          </select>
        </SettingRow>
        <SettingRow symbol="☀" color="green" title={t('general.launchAtLogin')} detail={t('general.launchAtLoginDetail')}><Toggle checked={preferences.launchAtLogin} onChange={(value) => update({ launchAtLogin: value })} /></SettingRow>
      </div>

      <div className="group-label">{t('general.recognition')}</div>
      <div className="settings-group">
        <SettingRow symbol="P3" color="indigo" title={t('general.localModel')} detail={t('general.localModelDetail')}><span className="model-badge">{snapshot.asrStatus.engine}</span></SettingRow>
        <SettingRow symbol="◎" color="green" title={t('general.language')} detail={t('models.languages')}><span className="row-value">{t('models.auto')}</span></SettingRow>
        <SettingRow symbol="◷" color="orange" title={t('general.silenceStop')} detail={t('general.silenceStopDetail')}>
          <select className="compact-select" value={preferences.autoStopSilenceMs} onChange={(event) => update({ autoStopSilenceMs: Number(event.target.value) })}>
            <option value={0}>{t('general.off')}</option><option value={2000}>{t('general.seconds', { count: 2 })}</option><option value={3000}>{t('general.seconds', { count: 3 })}</option><option value={5000}>{t('general.seconds', { count: 5 })}</option>
          </select>
        </SettingRow>
      </div>
      <div className="group-label">{t('general.help')}</div>
      <div className="settings-group"><SettingRow symbol="?" color="blue" title={t('general.onboarding')} detail={t('general.onboardingDetail')}><button className="model-retry" type="button" onClick={controller.restartOnboarding}>{t('general.open')}</button></SettingRow></div>
      {snapshot.error && <p className="inline-message" role="status">{snapshot.error}</p>}
    </div>
  )
}

function SettingRow({ symbol, color, title, detail, children }: { symbol: string; color: string; title: string; detail: string; children: React.ReactNode }): React.JSX.Element {
  return <div className="setting-row"><div className={`setting-symbol ${color}`} aria-hidden="true">{symbol}</div><div className="setting-copy"><strong>{title}</strong><span>{detail}</span></div>{children}</div>
}

function Toggle({ checked, onChange }: { checked: boolean; onChange(value: boolean): void }): React.JSX.Element {
  return <label className="toggle-control"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span /></label>
}

function meterStyle(index: number, level: number): React.CSSProperties {
  const count = 15
  const active = index < Math.round(level * count)
  const distance = Math.abs(index - Math.floor(count / 2))
  return { '--level': String(active ? 1 : 0.18), '--height': `${Math.max(8, (count - distance * 2) * 1.5)}px` } as React.CSSProperties
}

function formatAccelerator(value: string, platform: NodeJS.Platform): string {
  return value.replace('CommandOrControl', platform === 'darwin' ? '⌘' : 'Ctrl').replace('Shift', platform === 'darwin' ? '⇧' : 'Shift').replace('Option', platform === 'darwin' ? '⌥' : 'Alt').replaceAll('+', ' ')
}

function formatHoldKey(key: HoldKey, platform: NodeJS.Platform, locale: 'ru' | 'en'): string {
  const side = key.startsWith('left-') ? (locale === 'ru' ? 'Левый' : 'Left') : (locale === 'ru' ? 'Правый' : 'Right')
  const name = key.split('-')[1]
  if (!name) return key.toUpperCase()
  const names: Record<string, string> = { control: platform === 'darwin' ? 'Control' : 'Ctrl', option: platform === 'darwin' ? 'Option' : 'Alt', command: platform === 'darwin' ? 'Command' : 'Win', shift: 'Shift' }
  return `${side} ${names[name]}`
}

function recordingCopy(state: RecordingState, preferences: AppPreferences, platform: NodeJS.Platform, locale: 'ru' | 'en'): { label: string; detail: string } {
  const key = formatHoldKey(preferences.holdKey, platform, locale)
  const ru = locale === 'ru'
  const copy: Record<RecordingState, { label: string; detail: string }> = {
    idle: { label: ru ? 'Готов к диктовке' : 'Ready for dictation', detail: preferences.activationMode === 'hold' ? (ru ? `Удерживайте ${key} в любом поле ввода` : `Hold ${key} in any text field`) : (ru ? 'Нажмите горячую клавишу в любом поле ввода' : 'Press the hotkey in any text field') },
    starting: { label: ru ? 'Подключаем микрофон…' : 'Connecting microphone…', detail: ru ? 'При первом запуске подтвердите разрешение' : 'Confirm permission on first use' },
    recording: { label: ru ? 'Слушаю' : 'Listening', detail: preferences.activationMode === 'hold' ? (ru ? `00:00 · Отпустите ${key}, чтобы закончить` : `00:00 · Release ${key} to finish`) : (ru ? '00:00 · Нажмите, чтобы закончить' : '00:00 · Press to finish') },
    transcribing: { label: ru ? 'Распознаю речь…' : 'Recognizing speech…', detail: ru ? 'Обработка выполняется на устройстве' : 'Processing on this device' },
    error: { label: ru ? 'Не удалось записать' : 'Recording failed', detail: ru ? 'Проверьте доступ к микрофону и повторите' : 'Check microphone access and try again' }
  }
  return copy[state]
}
