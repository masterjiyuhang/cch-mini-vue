import { isArray } from '@cch-vue/shared'
import { Dep, createDep } from './dep'

export type EffectScheduler = (...args: any[]) => any
export interface ReactiveEffectOptions {
  lazy?: boolean
  scheduler?: EffectScheduler
}
export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

const targetMap = new WeakMap<object, any>()

// 用一个全局变量存储被注册的副作用函数
export let activeEffect: ReactiveEffect | undefined

export class ReactiveEffect<T = any> {
  // 当前effect是否处于激活状态
  active = true
  // 当前 effect 的父 effect
  parent: ReactiveEffect | undefined = undefined
  // 用来存储所有与该副作用函数相关联的依赖集合
  deps: Dep[] = []
  onStop?: () => void

  /**
   * @internal
   */
  private deferStop?: boolean

  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | null = null
  ) {}

  run() {
    // 如果 effect 不处于激活状态，直接执行 effect 函数
    if (!this.active) {
      return this.fn()
    }

    // 保存当前活跃的 effect
    let parent: ReactiveEffect | undefined = activeEffect
    let lastShouldTrack = shouldTrack

    // 遍历父级 effect，检查是否存在循环调用
    while (parent) {
      if (parent === this) {
        return // 存在循环调用，直接返回
      }
      parent = parent.parent
    }

    try {
      // 设置当前 effect 的父级为活跃的 effect，切换活跃的 activeEffect 为当前 effect
      this.parent = activeEffect
      activeEffect = this
      shouldTrack = true

      cleanupEffect(this)
      // 执行 effect 函数
      return this.fn()
    } finally {
      // 在 finally 块中进行清理操作

      // 恢复活跃的effect
      activeEffect = this.parent

      shouldTrack = lastShouldTrack
      // 清空当前effect的操作
      this.parent = undefined

      if (this.deferStop) {
        this.stop()
      }
    }
  }

  stop() {
    // stopped while running itself - defer the cleanup
    if (activeEffect === this) {
      this.deferStop = true
    } else if (this.active) {
      cleanupEffect(this)
      if (this.onStop) {
        this.onStop()
      }
      this.active = false
    }
  }
}

export let shouldTrack = true

function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions
): ReactiveEffectRunner {
  if ((fn as ReactiveEffectRunner).effect instanceof ReactiveEffect) {
    fn = (fn as ReactiveEffectRunner).effect.fn
  }

  const _effect = new ReactiveEffect(fn)

  if (options) {
    // 将options选项挂载到对应的副作用函数上
    Object.assign(_effect, options)
  }

  if (!options || !options.lazy) {
    _effect.run()
  }

  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner
  runner.effect = _effect
  return runner
}

export const stopRunner = (runner: ReactiveEffectRunner) => {
  runner.effect.stop()
}

// 添加订阅
export function track(target: object, key: unknown) {
  if (!isTracking()) {
    return
  }
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

export function isTracking() {
  return shouldTrack && !!activeEffect
}

export function trackEffects(deps: Dep) {
  let shouldTrack = false
  shouldTrack = !deps.has(activeEffect!)
  if (shouldTrack) {
    // 将副作用函数 effect 添加到存储副作用函数的🪣中
    deps.add(activeEffect!)
    // deps 就是一个与当前副作用函数存在「联系」的依赖集合，将其添加到 activeEffect.deps数组中。 完成对依赖结合的收集。
    // 有了这个「联系」之后，每次执行副作用函数的时候，可以根据EffectFn.deps获取所有相关联的依赖集合，进而将副作用函数从依赖集合中移除。
    activeEffect!.deps.push(deps)
  }
}

// 发布执行
export function trigger(target: object, key?: unknown, value?: unknown) {
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

export function triggerEffects(dep: Dep | ReactiveEffect[]) {
  const effects = isArray(dep) ? dep : [...dep]
  for (const effect of effects) {
    triggerEffect(effect)
  }
}

function triggerEffect(effect: ReactiveEffect) {
  // effect !== activeEffect 判断当前要执行的 effect 函数是否已经是活跃的 effect。
  // 如果是活跃的 effect，说明当前的 effect 函数正在被其他 effect 函数中调用，
  // 为了防止无限递归调用，就不再执行它。
  if (effect !== activeEffect) {
    // 如果一个副作用函数中存在调度器，则调用该调度器，并将副作用函数作为参数传递进去。
    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  }
}
