import { isObject } from '@cch-vue/shared'
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReactiveHandlers,
  shallowReadonlyHandlers
} from './baseHandlers'
import { ReactiveFlags } from './constants'

export interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.IS_SHALLOW]?: boolean
  [ReactiveFlags.RAW]?: any
}
export const reactiveMap = new WeakMap<Target, any>()
export const shallowReactiveMap = new WeakMap<Target, any>()
export const readonlyMap = new WeakMap<Target, any>()
export const shallowReadonlyMap = new WeakMap<Target, any>()

export function reactive<T extends object>(target: T): T {
  // 如果尝试监听一个只读的代理，直接返回只读对象。
  if (isReadonly(target)) {
    return target
  }
  return createReactiveObject(target, false, mutableHandlers, reactiveMap)
}

export declare const ShallowReactiveMarker: unique symbol
export type ShallowReactive<T> = T & { [ShallowReactiveMarker]?: true }
/**
 * Shallow version of {@link reactive()}
 * @param target The source target
 * @returns
 */
export function shallowReactive<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowReactiveMap
  )
}

export function readonly<T extends object>(target: T): T {
  return createReactiveObject(target, true, readonlyHandlers, readonlyMap)
}

export function shallowReadonly<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReactiveMap
  )
}

function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
) {
  // 要代理的不是一个对象
  if (!isObject(target)) {
    return target
  }

  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target
  }

  // 已经有了一个一样的对象被代理过了 直接返回代理对象
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  const proxy = new Proxy(target, baseHandlers)

  proxyMap.set(target, proxy)
  return proxy
}

export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}

export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    return isReactive((value as Target)[ReactiveFlags.RAW])
  }
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
}

export function isShallow(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_SHALLOW])
}

export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}

export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}

export const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value

export const toReadonly = <T extends unknown>(value: T): T =>
  isObject(value) ? readonly(value) : value
