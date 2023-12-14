import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import minimist from 'minimist'
import pico from 'picocolors'
import { execa, execaSync } from 'execa'
import { cpus } from 'node:os'
import { createRequire } from 'node:module'
import { fuzzyMatchTarget, targets as allTargets } from './utils.js'

// @ts-check
const require = createRequire(import.meta.url)
const args = minimist(process.argv.slice(2))
const targets = args._
const formats = args.formats || args.f
const devOnly = args.devOnly || args.d
const prodOnly = !devOnly && (args.prodOnly || args.p)
// const buildTypes = args.withTypes || args.t
const sourceMap = args.sourcemap || args.s
const isRelease = args.release
const buildAllMatching = args.all || args.a
const commit = execaSync('git', ['rev-parse', '--short=7', 'HEAD']).stdout

run()

async function run() {
  console.log(pico.red(pico.bold('start build..')), cpus().length)

  try {
    let resolvedTargets = targets.length
      ? fuzzyMatchTarget(targets, buildAllMatching)
      : allTargets
    await buildAll(resolvedTargets)
  } finally {
    console.log('end build..')
  }
}

async function buildAll(targets) {
  await runParallel(cpus().length, targets, build)
}

/**
 * 用于并行执行异步任务的函数，允许你指定最大并发数量
 * @param {*} maxConcurrency
 * @param {*} source
 * @param {*} iteratorFn
 * @returns {Promise<void[]>} - A Promise array containing all iteration results.
 */
async function runParallel(maxConcurrency, source, iteratorFn) {
  // 用于存储每个异步任务的Promise
  /**@type {Promise<void>[]} */
  const ret = []

  // 用于存储正在执行的异步任务的Promise
  /**@type {Promise<void>[]} */
  const executing = []

  // 遍历数据源中的每一项
  for (const item of source) {
    // 创建一个Promise，用于执行迭代函数(iteratorFn(item))
    const p = Promise.resolve().then(() => iteratorFn(item))
    // 将当前Promise添加到结果数组中
    ret.push(p)

    // 如果设置了最大并发数
    if (maxConcurrency <= source.length) {
      // 创建一个Promise，表示当前任务执行完成后的处理
      const e = p.then(() => executing.splice(executing.indexOf(e), 1))

      // 将当前任务的Promise添加到正在执行的数组中
      executing.push(e)

      // 如果正在执行的任务数量达到最大并发数
      if (executing.length >= maxConcurrency) {
        // 等待任意一个任务完成，以保持并发数量不超过最大值
        await Promise.race(executing)
      }
    }
  }

  // 返回一个Promise，当所有任务完成时，该Promise会resolve
  return Promise.all(ret)
}

/**
 * Builds the target.
 * @param {string} target - The target to build.
 * @returns {Promise<void>} - A promise representing the build process.
 */
async function build(target) {
  // 获取目标对应的包的路径
  const pkgDir = path.resolve(`packages/${target}`)
  // 读取目标包的 package.json 文件
  const pkg = require(`${pkgDir}/package.json`)

  console.log(target, 'target: ' + target)

  // 如果这是一个完整构建（没有指定特定的目标），并且包是私有的，则忽略构建
  if ((isRelease || !targets.length) && pkg.private) {
    return
  }

  // 如果构建一个特定格式（formats），则不删除 dist 目录
  if (!formats && existsSync(`${pkgDir}/dist`)) {
    // 删除 dist 目录
    await fs.rm(`${pkgDir}/dist`, { recursive: true })
  }

  // 获取构建时的环境变量
  const env =
    (pkg.buildOptions && pkg.buildOptions.env) ||
    (devOnly ? 'development' : 'production')

  console.log(
    'formats: ' + pico.blue(formats),
    'prodOnly: ' + pico.blue(prodOnly),
    'sourceMap: ' + pico.blue(sourceMap)
  )
  // 使用 execa 调用 rollup 构建命令
  await execa(
    'rollup',
    [
      '-c',
      '--environment',
      [
        `COMMIT:${commit}`,
        `NODE_ENV:${env}`,
        `TARGET:${target}`,
        formats ? `FORMATS:${formats}` : ``,
        prodOnly ? `PROD_ONLY:true` : ``,
        sourceMap ? `SOURCE_MAP:true` : ``
      ]
        .filter(Boolean)
        .join(',')
    ],
    { stdio: 'inherit' } // 将子进程的 stdio 传递给主进程
  )
}
