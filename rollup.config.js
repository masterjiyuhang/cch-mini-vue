import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import pico from 'picocolors'
import json from '@rollup/plugin-json'
import esbuild from 'rollup-plugin-esbuild'
import alias from '@rollup/plugin-alias'

console.log(process.env.NODE_ENV, '当前的运行环境是多少')

if (!process.env.TARGET) {
  throw new Error('TARGET package must be specified via --environment flag.')
}

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const masterVersion = require('./package.json').version

const packagesDir = path.resolve(__dirname, 'packages')
const packageDir = path.resolve(packagesDir, process.env.TARGET)

const resolve = p => path.resolve(packageDir, p)
const pkg = require(resolve(`package.json`))
const packageOptions = pkg.buildOptions || {}
const name = packageOptions.filename || path.basename(packageDir)

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

const defaultFormats = ['esm-builder', 'cjs']
const inlineFormats = process.env.FORMATS && process.env.FORMATS.split(',')
const packageFormats = inlineFormats || packageOptions.formats || defaultFormats

const packageConfigs = process.env.PROD_ONLY
  ? []
  : packageFormats.map(format => createConfig(format, outputConfigs[format]))

if (process.env.NODE_ENV === 'production') {
  packageFormats.forEach(format => {
    if (packageOptions.prod === false) {
      return
    }
    if (format === 'cjs') {
      packageConfigs.push(createProductionConfig(format))
    }
  })
}

// console.log('哈哈哈哈哈 😄😄😄😄😄😄😄😄😄😄😄😄', packageConfigs)
export default packageConfigs

function createConfig(format, output, plugins = []) {
  if (!output) {
    console.log(pico.yellow(`invalid format: "${format}"`))
    process.exit(1)
  }

  // const isProductionBuild =
  //   process.env.__DEV__ === 'false' || /\.prod\.js$/.test(output.file)
  // const isBundlerESMBuild = /esm-bundler/.test(format)
  const isBrowserESMBuild = /esm-browser/.test(format)
  const isServerRenderer = name === 'server-renderer'
  const isNodeBuild = format === 'cjs'
  const isGlobalBuild = /global/.test(format)
  const isCompatPackage =
    pkg.name === '@vue/compat' || pkg.name === '@vue/compat-canary'
  // const isCompatBuild = !!packageOptions.compat
  // const isBrowserBuild =
  //   (isGlobalBuild || isBrowserESMBuild || isBundlerESMBuild) &&
  //   !packageOptions.enableNonBrowserBranches

  output.exports = isCompatPackage ? 'auto' : 'named'
  if (isNodeBuild) {
    output.esModule = true
  }
  output.sourcemap = !!process.env.SOURCE_MAP
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

  function resolveExternal() {
    const treeShakenDeps = ['source-map-js', '@babel/parser', 'estree-walker']

    if (isGlobalBuild || isBrowserESMBuild || isCompatPackage) {
      if (!packageOptions.enableNonBrowserBranches) {
        // normal browser builds - non-browser only imports are tree-shaken,
        // they are only listed here to suppress warnings.
        return treeShakenDeps
      }
    } else {
      // Node / esm-bundler builds.
      // externalize all direct deps unless it's the compat build.
      return [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
        // for @vue/compiler-sfc / server-renderer
        ...['path', 'url', 'stream'],
        // somehow these throw warnings for runtime-* package builds
        ...treeShakenDeps
      ]
    }
  }

  function resolveNodePlugins() {
    // we are bundling forked consolidate.js in compiler-sfc which dynamically
    // requires a ton of template engines which should be ignored.
    let cjsIgnores = []
    if (
      pkg.name === '@vue/compiler-sfc' ||
      pkg.name === '@vue/compiler-sfc-canary'
    ) {
      cjsIgnores = [
        // ...Object.keys(consolidatePkg.devDependencies),
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

  const currentEntries = []
  return {
    input: resolve(entryFile),
    external: resolveExternal(),
    plugins: [
      json({ namedExports: false }),
      alias({
        entries: currentEntries
      }),
      esbuild({
        tsconfig: path.resolve(__dirname, 'tsconfig.json'),
        sourceMap: output.sourcemap,
        minify: false,
        target: isServerRenderer || isNodeBuild ? 'es2019' : 'es2015',
        define: resolveDefine()
      }),
      ...plugins,
      ...resolveNodePlugins()
    ],
    output
  }
}

function createProductionConfig(format) {
  return createConfig(format, {
    file: resolve(`dist/${name}.${format}.prod.js`),
    format: outputConfigs[format].format
  })
}
