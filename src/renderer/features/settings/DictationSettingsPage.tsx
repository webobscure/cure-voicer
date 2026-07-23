import { useSyncExternalStore } from 'react'
import type { AppPreferences, OverlayPlacementMode } from '../../../shared/contracts'
import type { CoreSettingsController } from '../../app/core-settings-controller'
import { useI18n } from '../../app/i18n/i18n-context'

export function DictationSettingsPage({ controller }: { controller: CoreSettingsController }): React.JSX.Element {
  const { t } = useI18n()
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const update = (patch: Partial<AppPreferences>): void => { void controller.updatePreferences(patch) }
  const placementLabels: Record<OverlayPlacementMode, string> = {
    'bottom-left': t('dictation.bottomLeft'), 'bottom-center': t('dictation.bottomCenter'),
    'bottom-right': t('dictation.bottomRight'), custom: t('dictation.custom')
  }
  return <div className="dictation-settings-feature">
    <div className="dictation-heading"><div className="empty-pane-icon blue" aria-hidden="true">♫</div><div><h2>{t('dictation.floatingIndicator')}</h2><p>{t('dictation.floatingIndicatorDetail')}</p></div></div>
    <div className="group-label">{t('dictation.placement')}</div>
    <div className="settings-group dictation-settings">
      <div className="setting-row placement-row"><div className="setting-copy"><strong>{t('dictation.screenPosition')}</strong><span>{placementLabels[snapshot.overlayPlacement.mode]}</span></div>
        <div className="placement-control" role="group" aria-label={t('dictation.screenPosition')}>
          {(['bottom-left', 'bottom-center', 'bottom-right'] as const).map((mode) => <button key={mode} type="button" disabled={snapshot.overlayPlacementBusy} className={snapshot.overlayPlacement.mode === mode ? 'is-active' : ''} aria-label={placementLabels[mode]} title={placementLabels[mode]} onClick={() => void controller.setOverlayPlacement(mode)}><i className={`corner-icon ${mode.replace('bottom-', '')}`} /></button>)}
        </div>
      </div>
      <div className="setting-row"><div className="setting-symbol cyan" aria-hidden="true">✥</div><div className="setting-copy"><strong>{t('dictation.freeMovement')}</strong><span>{t('dictation.freeMovementDetail')}</span></div><span className="row-value positive">{t('dictation.enabled')}</span></div>
    </div>
    <div className="group-label">{t('dictation.behavior')}</div>
    <div className="settings-group">
      <div className="setting-row"><div className="setting-symbol blue" aria-hidden="true">◉</div><div className="setting-copy"><strong>{t('dictation.showWhileIdle')}</strong><span>{t('dictation.showWhileIdleDetail')}</span></div><Toggle checked={snapshot.preferences.showOverlayWhenIdle} onChange={(value) => update({ showOverlayWhenIdle: value })} /></div>
      <div className="setting-row"><div className="setting-symbol purple" aria-hidden="true">∿</div><div className="setting-copy"><strong>{t('dictation.motion')}</strong><span>{t('dictation.motionDetail')}</span></div><select className="compact-select" value={snapshot.preferences.overlayMotion} onChange={(event) => update({ overlayMotion: event.target.value as AppPreferences['overlayMotion'] })}><option value="calm">{t('dictation.calm')}</option><option value="balanced">{t('dictation.balanced')}</option><option value="expressive">{t('dictation.expressive')}</option></select></div>
      <div className="setting-row"><div className="setting-symbol cyan" aria-hidden="true">▣</div><div className="setting-copy"><strong>{t('dictation.keepRecordings')}</strong><span>{t('dictation.keepRecordingsDetail')}</span></div><Toggle checked={snapshot.preferences.keepRecordings} onChange={(value) => update({ keepRecordings: value })} /></div>
    </div>
  </div>
}

function Toggle({ checked, onChange }: { checked: boolean; onChange(value: boolean): void }): React.JSX.Element {
  return <label className="toggle-control"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span /></label>
}
