import { isArray, isMap } from '@cch-vue/shared'
import { TriggerOpTypes, type TrackOpTypes } from './constants'
import { type Dep, createDep } from './dep'
import {
  type ReactiveEffect,
  activeEffect,
  shouldTrack,
  trackEffects,
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
    let deps = depsMap.get(key)
    if (!deps) {
      depsMap.set(key, (deps = createDep()))
    }

    trackEffects(deps)
  }
}

// 发布执行
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  value?: unknown
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

  // 将与 key 相关的依赖（Dep 对象）添加到 deps 数组中。
  deps.push(depsMap.get(key))

  switch (type) {
    case TriggerOpTypes.ADD:
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

  // for( const dep of deps ) {
  //   if(dep) {
  //     triggerEffects(dep)
  //   }
  // }
  // 接下来，根据数组 deps 的长度，决定如何触发副作用：
  // 如果 deps 中只有一个依赖，直接触发该依赖的副作用。
  if (deps.length === 1) {
    if (deps[0]) {
      triggerEffects(deps[0])
    }
  }
  // 如果 deps 中有多个依赖，将所有依赖的副作用合并成一个新的 Dep 对象，并触发该新的 Dep 对象的副作用。
  // 1. 多次调用同一个 effect 函数。多次使用相同的 target 和 key 调用 effect 函数，每次调用都会为这个依赖（Dep 对象）添加到 deps 数组中。
  // 2. 一个 effect 函数内部多次访问同一个键。如果在一个 effect 函数内部多次访问了同一个对象的相同键，每次访问都会为这个依赖（Dep 对象）添加到 deps 数组中
  else {
    const effects: ReactiveEffect[] = []
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep)
      }
    }
    // 避免无限执行
    triggerEffects(createDep(effects))
  }
}
