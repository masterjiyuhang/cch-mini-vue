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

export function ref(value?: unknown) {
  const res = new RefImpl(value)
  return res
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
