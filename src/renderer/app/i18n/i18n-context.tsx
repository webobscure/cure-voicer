import { createContext, useContext, useSyncExternalStore } from 'react'
import type { PropsWithChildren } from 'react'
import type { MessageKey, MessageValues } from './messages'
import { I18nStore, type ResolvedLocale } from './i18n-store'

const I18nContext = createContext<I18nStore | null>(null)

export function I18nProvider({
  store,
  children
}: PropsWithChildren<{ store: I18nStore }>): React.JSX.Element {
  return <I18nContext.Provider value={store}>{children}</I18nContext.Provider>
}

export function useI18n(): {
  locale: ResolvedLocale
  t: (key: MessageKey, values?: MessageValues) => string
} {
  const store = useContext(I18nContext)
  if (!store) throw new Error('I18nProvider is missing')
  const locale = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return {
    locale,
    t: (key, values) => store.translate(key, values)
  }
}
