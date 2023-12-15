import { isObject } from '@cch-vue/shared'
import { track, trigger } from './effect'

export const enum ReactiveFlags {
  SKIP = '__v_skip',
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw'
}

export interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.IS_SHALLOW]?: boolean
  [ReactiveFlags.RAW]?: any
}
export const reactiveMap = new WeakMap<Target, any>()

export function reactive<T extends object>(target: T): T {
  return createReactiveObject(target, false, reactiveMap)
}

function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  proxyMap: WeakMap<Target, any>
) {
  if (!isObject(target)) {
    return target
  }

  // target already has corresponding Proxy
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  const proxy = new Proxy(target, {
    get(target: Target, key: string | symbol, receiver: object) {
      const res = Reflect.get(target, key, receiver)
      console.log('get...', key)
      track(target, key)
      return res
    },
    set(target, key, value): boolean {
      console.log('set...', key, value)
      const result = Reflect.set(target, key, value)
      trigger(target, key, value)
      return result
    }
  })

  proxyMap.set(target, proxy)
  return proxy
}
