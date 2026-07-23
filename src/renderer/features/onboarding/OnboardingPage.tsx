import { useSyncExternalStore } from 'react'
import type { AsrStatus } from '../../../shared/contracts'
import { useI18n } from '../../app/i18n/i18n-context'
import type { MessageKey } from '../../app/i18n/messages'
import type {
  OnboardingController,
  OnboardingSnapshot
} from './onboarding-controller'

export function OnboardingPage({
  controller,
  logoUrl
}: {
  controller: OnboardingController
  logoUrl: string
}): React.JSX.Element {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  )
  const { t } = useI18n()
  const nextLabel = snapshot.step === 3 ? t('onboarding.finish') : t('common.continue')

  return (
    <section
      className="onboarding"
      id="onboarding"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboardingTitle"
      hidden={!snapshot.visible}
    >
      <div className="onboarding-glow glow-one" />
      <div className="onboarding-glow glow-two" />
      <div className="onboarding-panel">
        <header className="onboarding-header">
          <div className="onboarding-brand">
            <img src={logoUrl} alt="" draggable={false} />
            <span>Cure Voicer</span>
          </div>
          <div className="onboarding-progress" aria-label={t('onboarding.progressLabel')}>
            {[0, 1, 2, 3].map((step) => (
              <i className={snapshot.step === step ? 'is-active' : ''} key={step} />
            ))}
          </div>
        </header>

        <div className="onboarding-body">
          {snapshot.step === 0 && <WelcomeStep logoUrl={logoUrl} />}
          {snapshot.step === 1 && (
            <PermissionsStep controller={controller} snapshot={snapshot} />
          )}
          {snapshot.step === 2 && <UsageStep snapshot={snapshot} />}
          {snapshot.step === 3 && (
            <TestStep controller={controller} snapshot={snapshot} />
          )}
        </div>

        <footer className="onboarding-footer">
          <button
            className="onboarding-back"
            type="button"
            hidden={snapshot.step === 0}
            disabled={snapshot.busy}
            onClick={() => controller.setStep(snapshot.step - 1)}
          >
            {t('common.back')}
          </button>
          <button
            className="onboarding-next"
            type="button"
            disabled={snapshot.busy}
            onClick={() => {
              if (snapshot.step === 3) void controller.finish()
              else controller.setStep(snapshot.step + 1)
            }}
          >
            {nextLabel}
          </button>
        </footer>
      </div>
    </section>
  )
}

function WelcomeStep({ logoUrl }: { logoUrl: string }): React.JSX.Element {
  const { t } = useI18n()
  return (
    <article className="onboarding-step is-active" data-onboarding-step="0">
      <div className="welcome-orb">
        <span className="welcome-logo-mask">
          <img src={logoUrl} alt="" draggable={false} />
        </span>
      </div>
      <p className="eyebrow">{t('onboarding.localDictation')}</p>
      <h1 id="onboardingTitle">{t('onboarding.welcomeTitle')}</h1>
      <p className="onboarding-lead">{t('onboarding.welcomeLead')}</p>
      <div className="privacy-pill"><span>◆</span> {t('onboarding.localPrivacy')}</div>
    </article>
  )
}

function PermissionsStep({
  controller,
  snapshot
}: {
  controller: OnboardingController
  snapshot: OnboardingSnapshot
}): React.JSX.Element {
  const { t } = useI18n()
  const isMac = snapshot.platform === 'darwin'
  const microphoneClass = snapshot.microphonePermission === 'granted'
    ? 'is-granted'
    : snapshot.microphonePermission === 'denied'
      ? 'is-denied'
      : ''
  const microphoneLabel = snapshot.microphonePermission === 'granted'
    ? t('common.allowed')
    : snapshot.microphonePermission === 'denied'
      ? t('common.openSettings')
      : t('common.allow')
  const permissionMessage = snapshot.permissionMessage ?? (
    isMac ? t('onboarding.permissionPrivacyMac') : t('onboarding.permissionPrivacyWindows')
  )

  return (
    <article className="onboarding-step is-active" data-onboarding-step="1">
      <p className="eyebrow">{t('onboarding.permissionsEyebrow')}</p>
      <h1 id="onboardingTitle">{t('onboarding.permissionsTitle')}</h1>
      <p className="onboarding-lead compact">{t('onboarding.permissionsLead')}</p>
      <div className="permission-list">
        <div className="permission-card">
          <div className="permission-icon microphone">●</div>
          <div><strong>{t('onboarding.microphoneTitle')}</strong><span>{t('onboarding.microphoneDetail')}</span></div>
          <button className={microphoneClass} type="button" onClick={() => void controller.requestMicrophone()}>{microphoneLabel}</button>
        </div>
        <div className="permission-card">
          <div className="permission-icon accessibility">⌨</div>
          <div>
            <strong>{t(isMac ? 'onboarding.accessibilityTitle' : 'onboarding.windowsHotkeyTitle')}</strong>
            <span>{t(isMac ? 'onboarding.accessibilityDetail' : 'onboarding.windowsHotkeyDetail')}</span>
          </div>
          <button
            className={!isMac || snapshot.globalInputAvailable ? 'is-granted' : ''}
            type="button"
            onClick={() => void controller.requestAccessibility()}
          >
            {!isMac ? t('common.ready') : snapshot.globalInputAvailable ? t('common.allowed') : t('common.allow')}
          </button>
        </div>
      </div>
      <p className="permission-note">{permissionMessage}</p>
    </article>
  )
}

function UsageStep({ snapshot }: { snapshot: OnboardingSnapshot }): React.JSX.Element {
  const { t } = useI18n()
  const model = modelPresentation(snapshot.asrStatus)
  return (
    <article className="onboarding-step is-active" data-onboarding-step="2">
      <p className="eyebrow">{t('onboarding.usageEyebrow')}</p>
      <h1 id="onboardingTitle">{t('onboarding.usageTitle')}</h1>
      <p className="onboarding-lead compact">{t('onboarding.usageLead')}</p>
      <div className="onboarding-shortcut-card">
        <div className="shortcut-key">{snapshot.holdKeyGlyph}</div>
        <div><strong>{snapshot.holdKeyLabel}</strong><span>{t('onboarding.shortcutHint')}</span></div>
      </div>
      <div className="onboarding-model-card">
        <div className="model-pulse"><i /></div>
        <div>
          <strong>Parakeet V3</strong>
          <span>{t(model.detailKey, model.values)}</span>
          <progress max="1" value={snapshot.asrStatus.progress} hidden={snapshot.asrStatus.state === 'ready'} />
        </div>
        <b>{model.badge}</b>
      </div>
      <p className="model-footnote">{t('onboarding.modelFootnote')}</p>
    </article>
  )
}

function TestStep({
  controller,
  snapshot
}: {
  controller: OnboardingController
  snapshot: OnboardingSnapshot
}): React.JSX.Element {
  const { t } = useI18n()
  const recording = snapshot.recordingState === 'recording'
  const recognizing = snapshot.recordingState === 'transcribing'
  const disabled = snapshot.recordingState === 'starting' || recognizing || (
    !recording && snapshot.asrStatus.state !== 'ready'
  )
  const status = recording
    ? t('onboarding.testListening')
    : recognizing
      ? t('onboarding.testRecognizing')
      : snapshot.asrStatus.state === 'ready'
        ? t('onboarding.testReady')
        : t('onboarding.testPreparing')
  return (
    <article className="onboarding-step is-active" data-onboarding-step="3">
      <p className="eyebrow">{t('onboarding.testEyebrow')}</p>
      <h1 id="onboardingTitle">{t('onboarding.testTitle')}</h1>
      <p className="onboarding-lead compact">{t('onboarding.testLead')}</p>
      <div className="onboarding-test-box">
        <textarea readOnly value={snapshot.transcript} placeholder={t('onboarding.testPlaceholder')} />
        <div className="onboarding-test-footer">
          <span>{status}</span>
          <button type="button" disabled={disabled} onClick={() => void controller.toggleRecording()}>
            {recording ? t('common.stopRecording') : t('common.startRecording')}
          </button>
        </div>
      </div>
      <p className="permission-note">{t('onboarding.testOptional')}</p>
    </article>
  )
}

function modelPresentation(status: AsrStatus): {
  detailKey: MessageKey
  values?: Readonly<Record<string, string | number>>
  badge: string
} {
  const percent = Math.round(status.progress * 100)
  switch (status.state) {
    case 'downloading':
      return { detailKey: 'onboarding.modelDownloading', values: { percent }, badge: `${percent}%` }
    case 'loading':
      return { detailKey: 'onboarding.modelLoading', badge: '…' }
    case 'ready':
      return { detailKey: 'onboarding.modelReady', badge: '✓' }
    case 'downloaded':
      return { detailKey: 'onboarding.modelDownloaded', badge: '✓' }
    case 'error':
      return { detailKey: 'onboarding.modelFailed', badge: '!' }
    default:
      return { detailKey: 'onboarding.modelWaiting', badge: '…' }
  }
}
