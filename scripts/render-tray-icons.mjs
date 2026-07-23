import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const projectRoot = path.resolve(import.meta.dirname, '..')
const brandingDirectory = path.join(projectRoot, 'assets', 'branding')
const templateSvg = await readFile(path.join(brandingDirectory, 'cure-voicer-tray.svg'))

for (const [size, filename] of [
  [18, 'cure-voicer-trayTemplate.png'],
  [36, 'cure-voicer-trayTemplate@2x.png']
]) {
  const renderer = new Resvg(templateSvg, {
    fitTo: { mode: 'width', value: size }
  })
  await writeFile(path.join(brandingDirectory, filename), renderer.render().asPng())
}

const windowsSvg = await readFile(
  path.join(brandingDirectory, 'cure-voicer-tray-windows.svg')
)
const windowsRenderer = new Resvg(windowsSvg, {
  fitTo: { mode: 'width', value: 32 }
})
await writeFile(
  path.join(brandingDirectory, 'cure-voicer-tray-windows.png'),
  windowsRenderer.render().asPng()
)
