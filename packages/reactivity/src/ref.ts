import { isObject } from '@cch-vue/shared'
import { reactive } from '.'
import { type Dep } from './dep'
import {
  type ReactiveEffect,
  activeEffect,
  shouldTrack,
  trackEffects,
  triggerEffects
} from './effect'
import { toRaw } from './reactive'

declare const RefSymbol: unique symbol
export declare const RawSymbol: unique symbol

export interface Ref<T = any> {
  value: T
  /**
   * Type differentiator only.
   * We need this to be in public d.ts but don't want it to show up in IDE
   * autocomplete, so we use a private Symbol instead.
   */
  [RefSymbol]: true
}
export function ref(value?: unknown): any {
  return new RefImpl(value)
}
// 创建一个对象包裹基础类型 使其可以监听值的变化
class RefImpl<T> {
  private _value: T

  public dep?: Dep = undefined

  constructor(value: T) {
    this._value = isObject(value) ? reactive(value) : value
  }

  get value() {
    trackRefValue(this)
    return this._value
  }

  set value(newVal) {
    triggerRefValue(this, newVal)
    this._value = newVal
  }
}

export function trackRefValue(ref: any) {
  if (shouldTrack && activeEffect) {
    ref = toRaw(ref)

    if (!ref.dep) {
      ref.dep = new Set<ReactiveEffect>()
    }
    trackEffects(ref.dep)
  }
}

export function triggerRefValue(ref: any, newVal?: any) {
  ref = toRaw(ref)
  if (ref.dep) {
    triggerEffects(ref.dep)
  }
}
