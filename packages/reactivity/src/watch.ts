import { effect } from './effect'
import { isRef } from './ref'

type OnCleanup = (cleanupFn: () => void) => void

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup
) => any

export interface WatchOptions<T = boolean> {
  immediate?: T
  deep?: boolean
  once?: boolean
}

export function watch(
  source: any,
  cb: WatchCallback,
  options: WatchOptions = {}
) {
  // // 定义 getter
  let getter: () => any

  // 首先判断source的类型
  // 如果是ref类型 指向 source.value
  if (isRef(source)) {
    getter = () => source.value
  }
  // 如果是函数类型 说明用户直接传递了getter函数  这是直接使用用户的getter函数
  else if (typeof source === 'function') {
    getter = source
  }
  //  如果不是函数类型 保留之前遍历的做法
  else {
    getter = () => traverse(source)
  }

  // cleanup 用来存储用户注册的过期回调
  let cleanup: (() => void) | undefined

  // 定义 onInvalidate 函数
  function onInvalidate(fn: (() => void) | undefined) {
    // 将过期回调存储到 cleanup 中
    cleanup = fn
  }
  // 定义旧值与新值
  let oldValue: any, newValue

  // 提取 scheduler 调度函数为一个独立的 job 函数
  const job = () => {
    // 在 scheduler 中重新执行副作用函数，得到的是新值
    newValue = effectFn()
    // 在调用回调函数 cb 之前，先调用过期回调
    if (cleanup) {
      cleanup()
    }
    // 将旧值和新值作为回调函数的参数 同时将 onInvalidate 作为回调函数的第三个参数，以便用户使用
    cb(newValue, oldValue, onInvalidate)
    // 更新旧值，不然下一次会得到错误的旧值
    oldValue = newValue
  }
  // 使用 effect 注册副作用函数时，开启 lazy 选项，并把返回值存储到 effectFn 中以便后续手动调用
  const effectFn = effect(getter, {
    lazy: true,
    // 使用 job 函数作为调度器函数
    scheduler: job
  })

  // 回调函数的立即执 行与后续执行本质上没有任何差别 仅是触发时机的问题
  if (options.immediate) {
    // 第一次回调执行时没有所谓的旧值，因此此时回调函数的 oldValue 值为 undefined，这也是符合预期的。
    job()
  } else {
    // 手动调用副作用函数，拿到的值就是旧值
    oldValue = effectFn()
  }

  const unwatch = () => {}

  return unwatch
}

function traverse(value: any, sceen = new Set()): any {
  if (typeof value !== 'object' || value === null || sceen.has(value)) {
    return
  }

  sceen.add(value)

  for (const k in value) {
    traverse(value[k], sceen)
  }

  return value
}
