// @ts-check
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import picocolors from 'picocolors'
import json from '@rollup/plugin-json'
import commonJS from '@rollup/plugin-commonjs'
import polyfillNode from 'rollup-plugin-polyfill-node'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import esbuild from 'rollup-plugin-esbuild'
import alias from '@rollup/plugin-alias'

import { entries } from './scripts/aliases.js'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url)) // /Users/erhang/Documents/workspace/github/vue-source-code/cch-mini-vue/

const masterVersion = require('./package.json').version

const packagesDir = path.resolve(__dirname, 'packages')
const packageDir = path.resolve(packagesDir, process.env.TARGET || '') // process.env.TARGET  cch-vue shared reactivity

const resolve = p => path.resolve(packageDir, p)
const pkg = require(resolve(`package.json`))
const packageOptions = pkg.buildOptions || {}
const name = packageOptions.name || path.basename(packageDir)

const outputConfigs = {
  'esm-bundler': {
    file: resolve(`dist/${name}.esm-bundler.js`),
    format: `es`
  },
  'esm-browser': {
    file: resolve(`dist/${name}.esm-browser.js`),
    format: `es`
  },
  cjs: {
    file: resolve(`dist/${name}.cjs.js`),
    format: `cjs`
  },
  global: {
    file: resolve(`dist/${name}.global.js`),
    format: `iife`
  },
  // runtime-only builds, for main "vue" package only
  'esm-bundler-runtime': {
    file: resolve(`dist/${name}.runtime.esm-bundler.js`),
    format: `es`
  },
  'esm-browser-runtime': {
    file: resolve(`dist/${name}.runtime.esm-browser.js`),
    format: 'es'
  },
  'global-runtime': {
    file: resolve(`dist/${name}.runtime.global.js`),
    format: 'iife'
  }
}

const defaultFormats = ['esm-bundler', 'cjs']

const packageConfigs = defaultFormats.map(format =>
  createConfig(format, outputConfigs[format])
)

export default packageConfigs

/**
 * 创建rollup配置
 * @param {*} format
 * @param {*} output
 * @param {*} plugins
 */
function createConfig(format, output, plugins = []) {
  if (!output) {
    console.log(picocolors.yellow(`invalid format: ${format}`))
    process.exit(1)
  }

  // const isBundlerESMBuild = /esm-bundler/.test(format)
  const isNodeBuild = format === 'cjs'
  const isGlobalBuild = /global/.test(format)

  output.exports = 'named' // 该选项用于指定导出模式， named 适用于使用命名导出的情况

  if (isNodeBuild) {
    output.esModule = true
  }

  output.sourcemap = false
  output.externalLiveBindings = false

  if (isGlobalBuild) {
    output.name = packageOptions.name
  }

  let entryFile = /runtime$/.test(format) ? `src/runtime.ts` : `src/index.ts`

  function resolveDefine() {
    const replacements = {
      __VERSION__: `"${masterVersion}"`
    }

    Object.keys(replacements).forEach(key => {
      if (key in process.env) {
        replacements[key] = process.env[key]
      }
    })

    return replacements
  }

  function resolveNodePlugins() {
    let cjsIgnores = []
    if (
      pkg.name === '@vue/compiler-sfc' ||
      pkg.name === '@vue/compiler-sfc-canary'
    ) {
      cjsIgnores = [
        'vm',
        'crypto',
        'react-dom/server',
        'teacup/lib/express',
        'arc-templates/dist/es5',
        'then-pug',
        'then-jade'
      ]
    }

    const nodePlugins =
      (format === 'cjs' && Object.keys(pkg.devDependencies || {}).length) ||
      packageOptions.enableNonBrowserBranches
        ? [
            commonJS({
              sourceMap: false,
              ignore: cjsIgnores
            }),
            ...(format === 'cjs' ? [] : [polyfillNode()]),
            nodeResolve()
          ]
        : []

    return nodePlugins
  }
  return {
    input: resolve(entryFile),
    plugins: [
      json({
        namedExports: false
      }),
      alias({
        entries
      }),
      esbuild({
        tsconfig: path.resolve(__dirname, 'tsconfig.json'),
        sourceMap: output.sourcemap,
        minify: false,
        target: isNodeBuild ? 'es2019' : 'es2015',
        define: resolveDefine()
      }),
      ...resolveNodePlugins(),
      ...plugins
    ],
    output: output,
    treeshake: {
      moduleSideEffects: false
    }
  }
}
