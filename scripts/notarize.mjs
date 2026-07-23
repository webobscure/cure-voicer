import { notarize } from '@electron/notarize'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export default async function notarizeMac(context) {
  if (context.electronPlatformName !== 'darwin') return

  const options = getNotarizationOptions()
  if (!options) {
    console.info('macOS notarization skipped: release credentials are not configured')
    return
  }

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  )
  await notarize({ appPath, ...options })
  await execFileAsync('xcrun', ['stapler', 'staple', appPath])
  await execFileAsync('xcrun', ['stapler', 'validate', appPath])
  console.info('macOS notarization and stapling completed')
}

function getNotarizationOptions() {
  const apiValues = [
    process.env.APPLE_API_KEY,
    process.env.APPLE_API_KEY_ID,
    process.env.APPLE_API_ISSUER
  ]
  if (apiValues.some(Boolean)) {
    requireComplete(apiValues, 'APPLE_API_KEY, APPLE_API_KEY_ID, and APPLE_API_ISSUER')
    return {
      tool: 'notarytool',
      appleApiKey: apiValues[0],
      appleApiKeyId: apiValues[1],
      appleApiIssuer: apiValues[2]
    }
  }

  const idValues = [
    process.env.APPLE_ID,
    process.env.APPLE_APP_SPECIFIC_PASSWORD,
    process.env.APPLE_TEAM_ID
  ]
  if (idValues.some(Boolean)) {
    requireComplete(idValues, 'APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID')
    return {
      tool: 'notarytool',
      appleId: idValues[0],
      appleIdPassword: idValues[1],
      teamId: idValues[2]
    }
  }

  return null
}

function requireComplete(values, label) {
  if (values.every(Boolean)) return
  throw new Error(`Incomplete macOS notarization credentials: configure ${label}`)
}
