import { hasChanged, isObject } from '@cch-vue/shared'
import { reactive } from './index'
import { type Dep } from './dep'
import {
  type ReactiveEffect,
  activeEffect,
  shouldTrack,
  trackEffect,
  triggerEffects
} from './effect'
import { isReadonly, isShallow, toRaw } from './reactive'

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
  // return new RefImpl(value)
  return createRef(value, false)
}

export function shallowRef(value?: unknown) {
  return createRef(value, true)
}

function createRef(rawValue: unknown, shallow: boolean) {
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, shallow)
}

export function isRef(r: any): r is Ref {
  return !!(r && r.__v_isRef === true)
}

// 创建一个对象包裹基础类型 使其可以监听值的变化
class RefImpl<T> {
  private _value: T // 用于存储引用对象的值，存储经过处理后的值。
  private _rawValue: T // 存储原始值

  public dep?: Dep = undefined // 用于存储与该引用对象关联的依赖集合
  public readonly __v_isRef = true // 只读属性 用于标识该对象是一个引用对象

  /**
   * 构造函数
   * @param value 初始值
   * @param __v_isShallow 否浅层处理
   */
  constructor(
    value: T,
    public readonly __v_isShallow: boolean
  ) {
    this._rawValue = __v_isShallow ? value : toRaw(value)
    this._value = __v_isShallow
      ? value
      : isObject(value)
        ? reactive(value)
        : value
  }

  get value() {
    trackRefValue(this)
    return this._value
  }

  set value(newVal) {
    const useDirectValue =
      this.__v_isShallow || isShallow(newVal) || isReadonly(newVal)

    newVal = useDirectValue ? newVal : toRaw(newVal)

    if (hasChanged(newVal, this._rawValue)) {
      this._rawValue = newVal
      this._value = newVal
      triggerRefValue(this, newVal)
    }
  }
}

/**
 * 用于获取和设置引用对象的值
 * @param ref
 */
export function trackRefValue(ref: any) {
  if (shouldTrack && activeEffect) {
    ref = toRaw(ref)

    if (!ref.dep) {
      ref.dep = new Set<ReactiveEffect>()
    }
    trackEffect(activeEffect, ref.dep)
  }
}

/**
 * 用于触发引用对象的值的更新
 * @param ref
 * @param newVal
 */
export function triggerRefValue(ref: any, newVal?: any) {
  ref = toRaw(ref)
  if (ref.dep) {
    triggerEffects(ref.dep)
  }
}
