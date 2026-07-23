import { useState, useSyncExternalStore } from 'react'
import type { SmartCorrectionState } from '../../../shared/contracts'
import type { DesktopClient } from '../../app/services/desktop-client'
import { useI18n } from '../../app/i18n/i18n-context'
import type { MessageKey } from '../../app/i18n/messages'
import type { ModelSettingsStore } from '../../app/model-settings-store'

export function ModelsPage({ client, store }: { client: DesktopClient; store: ModelSettingsStore }): React.JSX.Element {
  const { t } = useI18n()
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [status, setStatus] = useState('')
  const asrBusy = snapshot.asr.state === 'downloading' || snapshot.asr.state === 'loading'
  const correctionBusy = snapshot.smartCorrection.state === 'downloading' || snapshot.smartCorrection.state === 'loading'

  const retryAsr = async (): Promise<void> => {
    try {
      store.update({ asr: await client.prepareAsr() })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('models.asrFailed'))
    }
  }

  const toggleCorrection = async (enabled: boolean): Promise<void> => {
    try {
      const preferences = await client.updatePreferences({ smartCorrectionEnabled: enabled })
      store.update({ smartCorrectionEnabled: preferences.smartCorrectionEnabled })
      if (enabled) store.update({ smartCorrection: await client.prepareSmartCorrection() })
      setStatus(enabled ? t('models.correctionEnabled') : t('models.correctionDisabled'))
    } catch (error) {
      const preferences = await client.getPreferences()
      store.update({ smartCorrectionEnabled: preferences.smartCorrectionEnabled })
      setStatus(error instanceof Error ? error.message : t('models.correctionFailed'))
    }
  }

  const asrPresentation = statePresentation(snapshot.asr.state, t, snapshot.asr.progress)
  const correctionPresentation = statePresentation(snapshot.smartCorrection.state, t, snapshot.smartCorrection.progress)
  return (
    <div className="models-feature">
      <div className="group-label">{t('models.activeModel')}</div>
      <div className="model-card">
        <div className="model-card-icon">P3</div>
        <div>
          <strong>{snapshot.asr.modelName}</strong>
          <span>{snapshot.asr.error ?? asrDetail(snapshot.asr.state, snapshot.asr.progress, t)}</span>
          <progress max="1" value={snapshot.asr.progress} hidden={!asrBusy} />
        </div>
        {snapshot.asr.state === 'error' && <button className="model-retry" type="button" onClick={() => void retryAsr()}>{t('models.retry')}</button>}
        <span className="model-badge">{asrPresentation}</span>
      </div>
      <div className="group-label">{t('models.textCorrection')}</div>
      <div className="settings-group">
        <div className="setting-row smart-correction-row">
          <div className="setting-symbol indigo" aria-hidden="true">✦</div>
          <div className="setting-copy">
            <strong>{t('models.smartCorrection')}</strong>
            <span>{snapshot.smartCorrection.error ?? correctionDetail(snapshot.smartCorrection.state, snapshot.smartCorrectionEnabled, snapshot.smartCorrection.progress, t)}</span>
            <progress max="1" value={snapshot.smartCorrection.progress} hidden={!correctionBusy} />
          </div>
          <label className="toggle-control">
            <input type="checkbox" checked={snapshot.smartCorrectionEnabled} disabled={correctionBusy} onChange={(event) => void toggleCorrection(event.target.checked)} />
            <span />
          </label>
        </div>
        <div className="setting-row compact-row">
          <div className="setting-copy"><strong>{snapshot.smartCorrection.modelName}</strong><span>{t('models.localSize')}</span></div>
          <span className="row-value">{correctionPresentation}</span>
        </div>
      </div>
      <div className="group-label">{t('models.information')}</div>
      <div className="settings-group">
        <div className="setting-row compact-row"><div className="setting-copy"><strong>{t('models.engine')}</strong><span>{snapshot.asr.engine}</span></div><span className="status-dot" /></div>
        <div className="setting-row compact-row"><div className="setting-copy"><strong>{t('models.processing')}</strong><span>{snapshot.platform === 'darwin' ? 'Apple Neural Engine · Core ML' : 'CPU · ONNX Runtime'}</span></div><span className="row-value positive">{t('models.local')}</span></div>
        <div className="setting-row compact-row"><div className="setting-copy"><strong>{t('models.language')}</strong><span>{t('models.languages')}</span></div><span className="row-value">{t('models.auto')}</span></div>
      </div>
      <p className="inline-message" role="status">{status}</p>
    </div>
  )
}

function statePresentation(state: SmartCorrectionState, t: ReturnType<typeof useI18n>['t'], progress: number): string {
  if (state === 'downloading') return `${Math.round(progress * 100)}%`
  const key: Record<Exclude<SmartCorrectionState, 'downloading'>, MessageKey> = {
    'not-downloaded': 'models.notDownloaded', downloaded: 'models.downloaded',
    loading: 'common.preparing', ready: 'models.active', error: 'common.error'
  }
  return t(key[state])
}

function asrDetail(state: SmartCorrectionState, progress: number, t: ReturnType<typeof useI18n>['t']): string {
  if (state === 'downloading') return t('models.asrDownloading', { percent: Math.round(progress * 100) })
  const key: Record<Exclude<SmartCorrectionState, 'downloading'>, MessageKey> = {
    'not-downloaded': 'models.asrNotDownloaded', downloaded: 'models.asrDownloaded',
    loading: 'models.asrLoading', ready: 'models.asrReady', error: 'models.asrFailed'
  }
  return t(key[state])
}

function correctionDetail(state: SmartCorrectionState, enabled: boolean, progress: number, t: ReturnType<typeof useI18n>['t']): string {
  if (state === 'downloading') return t('models.correctionDownloading', { percent: Math.round(progress * 100) })
  if (state === 'ready') return t(enabled ? 'models.correctionActiveDetail' : 'models.correctionReadyDetail')
  const key: Record<Exclude<SmartCorrectionState, 'downloading' | 'ready'>, MessageKey> = {
    'not-downloaded': 'models.correctionNotDownloaded', downloaded: 'models.correctionDownloaded',
    loading: 'models.correctionLoading', error: 'models.correctionFailed'
  }
  return t(key[state])
}
