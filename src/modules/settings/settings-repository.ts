import type { SettingsV1 } from '../../shared/validation/settings'

export interface SettingsRepository {
  load(): Promise<SettingsV1>
  save(settings: SettingsV1): Promise<void>
  update(patch: Partial<Omit<SettingsV1, 'schemaVersion'>>): Promise<SettingsV1>
}

