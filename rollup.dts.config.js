// @ts-check
import dts from 'rollup-plugin-dts'
import MagicString from 'magic-string'
import { parse } from '@babel/parser'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'

if (!existsSync('temp/packages')) {
  console.warn(
    'no temp dts files found. run `tsc -p tsconfig.build.json` first.'
  )
  process.exit(1)
}

const packages = readdirSync('temp/packages')
const targets = process.env.TARGETS ? process.env.TARGETS.split(',') : null
const targetPackages = targets
  ? packages.filter(pkg => targets.includes(pkg))
  : packages

export default targetPackages.map(pkg => {
  return {
    input: `./temp/packages/${pkg}/src/index.d.ts`,
    output: {
      file: `packages/${pkg}/dist/${pkg}.d.ts`,
      format: 'es'
    },
    plugins: [
      dts(),
      patchTypes(pkg),
      ...(pkg === 'cch-vue' ? [copyMts()] : [])
    ],
    onwarn(warning, warn) {
      // during dts rollup, everything is externalized by default
      if (
        warning.code === 'UNRESOLVED_IMPORT' &&
        !warning.exporter.startsWith('.')
      ) {
        return
      }
      warn(warning)
    }
  }
})

function patchTypes(pkg) {
  return {
    name: 'patch-types',
    renderChunk(code, chunk) {
      const s = new MagicString(code)
      const ast = parse(code, {
        plugins: ['typescript'],
        sourceType: 'module'
      })

      /**
       * @param {import('@babel/types').VariableDeclarator | import('@babel/types').TSTypeAliasDeclaration | import('@babel/types').TSInterfaceDeclaration | import('@babel/types').TSDeclareFunction | import('@babel/types').TSInterfaceDeclaration | import('@babel/types').TSEnumDeclaration | import('@babel/types').ClassDeclaration} node
       * @param {import('@babel/types').VariableDeclaration} [parentDecl]
       */
      function processDeclaration(node, parentDecl) {
        if (!node.id) {
          return
        }
        // @ts-ignore
        const name = node.id.name
        if (name.startsWith('_')) {
          return
        }
        shouldRemoveExport.add(name)
        if (isExported.has(name)) {
          // @ts-ignore
          s.prependLeft((parentDecl || node).start, `export `)
        }
      }

      const isExported = new Set()
      const shouldRemoveExport = new Set()

      // pass 0: check all exported types
      for (const node of ast.program.body) {
        if (node.type === 'ExportNamedDeclaration' && !node.source) {
          for (let i = 0; i < node.specifiers.length; i++) {
            const spec = node.specifiers[i]
            if (spec.type === 'ExportSpecifier') {
              isExported.add(spec.local.name)
            }
          }
        }
      }

      // pass 1: add exports
      for (const node of ast.program.body) {
        if (node.type === 'VariableDeclaration') {
          processDeclaration(node.declarations[0], node)
          if (node.declarations.length > 1) {
            throw new Error(
              `unhandled declare const with more than one declarators:\n${code.slice(
                // @ts-ignore
                node.start,
                node.end
              )}`
            )
          }
        } else if (
          node.type === 'TSTypeAliasDeclaration' ||
          node.type === 'TSInterfaceDeclaration' ||
          node.type === 'TSDeclareFunction' ||
          node.type === 'TSEnumDeclaration' ||
          node.type === 'ClassDeclaration'
        ) {
          processDeclaration(node)
        }
      }

      // pass 2: remove exports
      for (const node of ast.program.body) {
        if (node.type === 'ExportNamedDeclaration' && !node.source) {
          let removed = 0
          for (let i = 0; i < node.specifiers.length; i++) {
            const spec = node.specifiers[i]
            if (
              spec.type === 'ExportSpecifier' &&
              shouldRemoveExport.has(spec.local.name)
            ) {
              // @ts-ignore
              const exported = spec.exported.name
              if (exported !== spec.local.name) {
                // this only happens if we have something like
                //   type Foo
                //   export { Foo as Bar }
                continue
              }
              const next = node.specifiers[i + 1]
              if (next) {
                // @ts-ignore
                s.remove(spec.start, next.start)
              } else {
                // last one
                const prev = node.specifiers[i - 1]
                // @ts-ignore
                s.remove(prev ? prev.end : spec.start, spec.end)
              }
              removed++
            }
          }
          if (removed === node.specifiers.length) {
            // @ts-ignore
            s.remove(node.start, node.end)
          }
        }
      }
      code = s.toString()

      // append pkg specific types
      const additionalTypeDir = `packages/${pkg}/types`
      if (existsSync(additionalTypeDir)) {
        code +=
          '\n' +
          readdirSync(additionalTypeDir)
            .map(file => readFileSync(`${additionalTypeDir}/${file}`, 'utf-8'))
            .join('\n')
      }

      return code
    }
  }
}

function copyMts() {
  return {
    name: 'copy-vue-mts',
    writeBundle(_, bundle) {
      writeFileSync(
        'packages/cch-vue/dist/vue.d.mts',
        // @ts-ignore
        bundle['cch-vue.d.ts'].code
      )
    }
  }
}
