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

  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = createDep()))
  }

  trackEffects(dep)
}

export function isTracking() {
  return shouldTrack && !!activeEffect
}

export function trackEffects(dep: Dep) {
  let shouldTrack = false
  shouldTrack = !dep.has(activeEffect!)
  if (shouldTrack) {
    dep.add(activeEffect!)
    activeEffect!.deps.push(dep)
  }
}

// 发布执行
export function trigger(target: object, key?: unknown, value?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // never been tracked
    return
  }

  let deps: (Dep | undefined)[] = []

  deps.push(depsMap.get(key))

  if (deps.length === 1) {
    if (deps[0]) {
      triggerEffects(deps[0])
    }
  } else {
    const effects: ReactiveEffect[] = []
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep)
      }
    }
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
    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  }
}
