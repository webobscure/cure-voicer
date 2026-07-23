export const englishMessages = {
  'common.allow': 'Allow',
  'common.allowed': 'Allowed',
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.continue': 'Continue',
  'common.done': 'Done',
  'common.error': 'Error',
  'common.loading': 'Loading…',
  'common.openSettings': 'Settings',
  'common.preparing': 'Preparing',
  'common.ready': 'Ready',
  'common.startRecording': 'Start recording',
  'common.stopRecording': 'Stop',
  'onboarding.progressLabel': 'Setup step',
  'onboarding.localDictation': 'Local dictation',
  'onboarding.welcomeTitle': 'Speak. Your text appears.',
  'onboarding.welcomeLead':
    'Cure Voicer recognizes Russian, English, and mixed speech directly on your computer.',
  'onboarding.localPrivacy': 'Audio is not sent to the cloud',
  'onboarding.permissionsEyebrow': 'Permissions',
  'onboarding.permissionsTitle': 'Prepare dictation',
  'onboarding.permissionsLead':
    'Permissions are used only to record speech and start dictation while a key is held.',
  'onboarding.microphoneTitle': 'Microphone',
  'onboarding.microphoneDetail': 'Records your voice only during dictation',
  'onboarding.accessibilityTitle': 'Accessibility',
  'onboarding.accessibilityDetail': 'Detects the hold key in any application',
  'onboarding.windowsHotkeyTitle': 'Windows global hotkey',
  'onboarding.windowsHotkeyDetail': 'Works globally without a separate system permission',
  'onboarding.permissionPrivacyMac':
    'Cure Voicer sees only the selected key press and does not read application contents.',
  'onboarding.permissionPrivacyWindows':
    'Windows only requires microphone access. Audio stays on this computer.',
  'onboarding.permissionOpenMac':
    'Enable Cure Voicer in System Settings, return here, and try again.',
  'onboarding.permissionRequiredMicrophone':
    'Allow microphone access before continuing. Dictation cannot record without it.',
  'onboarding.permissionRequiredAccessibility':
    'Enable Cure Voicer under Accessibility to start dictation by holding a key.',
  'onboarding.usageEyebrow': 'How it works',
  'onboarding.usageTitle': 'Hold — speak — release',
  'onboarding.usageLead':
    'When you release the key, speech is recognized and inserted into the active field.',
  'onboarding.shortcutHint': 'You can change this later under General',
  'onboarding.modelDownloading': 'Downloading to this computer · {percent}%',
  'onboarding.modelLoading': 'Starting the model on this computer…',
  'onboarding.modelReady': 'Runs locally and is ready for dictation',
  'onboarding.modelFailed': 'Could not prepare the model',
  'onboarding.modelWaiting': 'Waiting to prepare',
  'onboarding.modelDownloaded': 'Downloaded',
  'onboarding.modelFootnote':
    'Parakeet downloads automatically. You can enable Qwen smart correction (about 834 MB) later under Models.',
  'onboarding.testEyebrow': 'Test',
  'onboarding.testTitle': 'Try it now',
  'onboarding.testLead': 'Press the button, say a phrase, then stop recording.',
  'onboarding.testPlaceholder': 'Recognized text will appear here…',
  'onboarding.testOptional': 'The test is optional and can be skipped.',
  'onboarding.testListening': 'Listening…',
  'onboarding.testRecognizing': 'Recognizing locally…',
  'onboarding.testReady': 'Ready to test',
  'onboarding.testPreparing': 'Model is preparing',
  'onboarding.testEmpty': 'No speech was recognized. Please try again.',
  'onboarding.finish': 'Start using Cure Voicer'
} as const

export type MessageKey = keyof typeof englishMessages
export type MessageValues = Readonly<Record<string, string | number>>

export const russianMessages: Record<MessageKey, string> = {
  'common.allow': 'Разрешить',
  'common.allowed': 'Разрешено',
  'common.back': 'Назад',
  'common.cancel': 'Отмена',
  'common.continue': 'Продолжить',
  'common.done': 'Готово',
  'common.error': 'Ошибка',
  'common.loading': 'Загрузка…',
  'common.openSettings': 'Настройки',
  'common.preparing': 'Подготовка',
  'common.ready': 'Готово',
  'common.startRecording': 'Начать запись',
  'common.stopRecording': 'Остановить',
  'onboarding.progressLabel': 'Шаг настройки',
  'onboarding.localDictation': 'Локальная диктовка',
  'onboarding.welcomeTitle': 'Говорите. Текст появится сам.',
  'onboarding.welcomeLead':
    'Cure Voicer распознаёт русскую, английскую и смешанную речь прямо на вашем компьютере.',
  'onboarding.localPrivacy': 'Аудио не отправляется в облако',
  'onboarding.permissionsEyebrow': 'Разрешения',
  'onboarding.permissionsTitle': 'Подготовим диктовку',
  'onboarding.permissionsLead':
    'Доступы нужны только для записи речи и запуска удержанием клавиши.',
  'onboarding.microphoneTitle': 'Микрофон',
  'onboarding.microphoneDetail': 'Записывает голос только во время диктовки',
  'onboarding.accessibilityTitle': 'Универсальный доступ',
  'onboarding.accessibilityDetail': 'Распознаёт удержание клавиши в любом приложении',
  'onboarding.windowsHotkeyTitle': 'Горячая клавиша Windows',
  'onboarding.windowsHotkeyDetail': 'Работает глобально без отдельного системного разрешения',
  'onboarding.permissionPrivacyMac':
    'Cure Voicer видит только нажатие выбранной клавиши и не читает содержимое приложений.',
  'onboarding.permissionPrivacyWindows':
    'В Windows понадобится только разрешение на микрофон. Аудио остаётся на компьютере.',
  'onboarding.permissionOpenMac':
    'Включите Cure Voicer в Системных настройках, вернитесь сюда и нажмите ещё раз.',
  'onboarding.permissionRequiredMicrophone':
    'Разрешите доступ к микрофону — без него диктовка не сможет начать запись.',
  'onboarding.permissionRequiredAccessibility':
    'Для запуска удержанием включите Cure Voicer в разделе «Универсальный доступ».',
  'onboarding.usageEyebrow': 'Как пользоваться',
  'onboarding.usageTitle': 'Удерживайте — говорите — отпускайте',
  'onboarding.usageLead':
    'После отпускания речь распознается и текст вставится в активное поле.',
  'onboarding.shortcutHint': 'Можно изменить позже в разделе «Основные»',
  'onboarding.modelDownloading': 'Загружаем на компьютер · {percent}%',
  'onboarding.modelLoading': 'Запускаем модель на этом компьютере…',
  'onboarding.modelReady': 'Работает локально и готова к диктовке',
  'onboarding.modelFailed': 'Не удалось подготовить модель',
  'onboarding.modelWaiting': 'Ожидает подготовки',
  'onboarding.modelDownloaded': 'Загружена',
  'onboarding.modelFootnote':
    'Parakeet загружается автоматически. Умную коррекцию Qwen (около 834 МБ) можно включить позже в разделе «Модели».',
  'onboarding.testEyebrow': 'Проверка',
  'onboarding.testTitle': 'Попробуйте прямо сейчас',
  'onboarding.testLead': 'Нажмите кнопку, произнесите фразу и остановите запись.',
  'onboarding.testPlaceholder': 'Здесь появится распознанный текст…',
  'onboarding.testOptional': 'Тест необязателен — его можно пропустить.',
  'onboarding.testListening': 'Слушаю…',
  'onboarding.testRecognizing': 'Распознаю локально…',
  'onboarding.testReady': 'Готово к проверке',
  'onboarding.testPreparing': 'Модель готовится',
  'onboarding.testEmpty': 'Речь не распознана. Попробуйте ещё раз.',
  'onboarding.finish': 'Начать работу'
}

export function formatMessage(
  locale: 'ru' | 'en',
  key: MessageKey,
  values: MessageValues = {}
): string {
  const template = locale === 'ru' ? russianMessages[key] : englishMessages[key]
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match
  )
}
