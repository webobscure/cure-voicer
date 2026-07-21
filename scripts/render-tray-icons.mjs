import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const projectRoot = path.resolve(import.meta.dirname, '..')
const brandingDirectory = path.join(projectRoot, 'assets', 'branding')
const svg = await readFile(path.join(brandingDirectory, 'cure-voicer-tray.svg'))

for (const [size, filename] of [
  [18, 'cure-voicer-trayTemplate.png'],
  [36, 'cure-voicer-trayTemplate@2x.png']
]) {
  const renderer = new Resvg(svg, {
    fitTo: { mode: 'width', value: size }
  })
  await writeFile(path.join(brandingDirectory, filename), renderer.render().asPng())
}
