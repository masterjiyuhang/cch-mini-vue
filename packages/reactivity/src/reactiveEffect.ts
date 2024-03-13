import { isArray, isIntegerKey, isMap, isSymbol } from '@cch-vue/shared'
import { TriggerOpTypes, type TrackOpTypes } from './constants'
import { type Dep, createDep } from './dep'
import {
  type ReactiveEffect,
  activeEffect,
  shouldTrack,
  trackEffect,
  triggerEffects
} from './effect'

type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<object, KeyToDepMap>()

export const ITERATE_KEY = Symbol('')
export const MAP_KEY_ITERATE_KEY = Symbol('')
// 添加订阅
export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (shouldTrack && activeEffect) {
    // 在副作用函数与被操作的目标字段之前建立明确的联系
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = createDep()))
    }

    trackEffect(activeEffect, dep)
  }
}

/**
 * 触发响应式
 * @param target 触发响应时的目标对象
 * @param type 触发响应时的类型
 * @param key 触发响应时的键名
 * @param newValue 触发响应时的新值
 * @param oldValue
 * @returns
 */
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown
) {
  // 首先，通过 targetMap 获取与目标对象 target 相关的依赖映射（depsMap）。
  const depsMap = targetMap.get(target)

  // 如果不存在依赖映射，说明这个目标对象从未被追踪，直接返回。
  if (!depsMap) {
    // never been tracked
    return
  }

  // 然后，定义一个数组 deps，用于存储与指定键 key 相关的所有依赖（Dep 对象）。
  let deps: (Dep | undefined)[] = []

  if (type === TriggerOpTypes.CLEAR) {
    deps = [...depsMap.values()]
  }
  // 如果操作目标是数组，并且修改了数组的 length 属性
  else if (key === 'length' && isArray(target)) {
    const newLength = Number(newValue)
    depsMap.forEach((dep, key) => {
      // 对于索引大于或等于新的 length 值的元素， 需要把所有相关联的副作用函数取出来并添加到 deps 中等待执行
      if (key === 'length' || (!isSymbol(key) && key >= newLength)) {
        deps.push(dep)
      }
    })
  } else {
    // schedule runs for SET | ADD | DELETE
    if (key !== void 0) {
      // 将与 key 相关的依赖（Dep 对象）添加到 deps 数组中。
      deps.push(depsMap.get(key))
    }

    switch (type) {
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          // 当操作类型为 ADD 并且目标对象是数组时，应该取出并执行那些与 length 属性相关联的副作用函数
          deps.push(depsMap.get(ITERATE_KEY))
        } else if (isIntegerKey(key)) {
          // new index added to array -> length changes
          deps.push(depsMap.get('length'))
        }
        break
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
        }
        break
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }

  // // 接下来，根据数组 deps 的长度，决定如何触发副作用：
  // // 如果 deps 中只有一个依赖，直接触发该依赖的副作用。
  // if (deps.length === 1) {
  //   if (deps[0]) {
  //     triggerEffects(deps[0])
  //   }
  // }
  // // 如果 deps 中有多个依赖，将所有依赖的副作用合并成一个新的 Dep 对象，并触发该新的 Dep 对象的副作用。
  // // 1. 多次调用同一个 effect 函数。多次使用相同的 target 和 key 调用 effect 函数，每次调用都会为这个依赖（Dep 对象）添加到 deps 数组中。
  // // 2. 一个 effect 函数内部多次访问同一个键。如果在一个 effect 函数内部多次访问了同一个对象的相同键，每次访问都会为这个依赖（Dep 对象）添加到 deps 数组中
  // else {
  //   const effects: ReactiveEffect[] = []
  //   for (const dep of deps) {
  //     if (dep) {
  //       effects.push(...dep)
  //     }
  //   }
  //   // 避免无限执行
  //   triggerEffects(createDep(effects))
  // }

  const effectsToRun: ReactiveEffect[] = []
  for (const dep of deps) {
    if (dep) {
      effectsToRun.push(...dep)
    }
  }
  // 避免无限执行
  triggerEffects(createDep(effectsToRun))
}
