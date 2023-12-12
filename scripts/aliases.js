// @ts-check
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const resolveEntryForPkg = p =>
  path.resolve(
    fileURLToPath(import.meta.url),
    `../../packages/${p}/src/index.ts`
  )

const dirs = readdirSync(new URL('../packages', import.meta.url))
const entries = {
  vue: resolveEntryForPkg('cch-vue'),
}
for (const dir of dirs) {
  const key = `@cch-vue/${dir}`

  if (
    dir !== 'cch-vue' &&
    statSync(new URL(`../packages/${dir}`, import.meta.url)).isDirectory()
  ) {
    entries[key] = resolveEntryForPkg(dir)
  }
}

console.log(entries)
export { entries }
