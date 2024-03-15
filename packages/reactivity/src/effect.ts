import { isArray } from '@cch-vue/shared'
import { type Dep } from './dep'

export type EffectScheduler = (...args: any[]) => any
export interface ReactiveEffectOptions {
  lazy?: boolean
  scheduler?: EffectScheduler
}
export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

// const targetMap = new WeakMap<object, any>()

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
    // 检查当前的activeEffect是否就是当前effect对象的this
    // 如果是说明当前effect是正在运行的，此时将 deferStop 设置为true。
    // 这样做是为了在effect函数中通过调用stop方法来延迟停止effect的执行，而不是立即执行。
    if (activeEffect === this) {
      this.deferStop = true
    }
    // 如果当前的 effect 不是正在运行的 effect，并且当前的 effect 是活跃的（active 属性为 true），则执行下面的操作。
    else if (this.active) {
      // 调用 cleanupEffect 函数，该函数用于清理与 effect 相关的依赖和其他资源。这是确保在停止 effect 时进行必要的清理工作。
      cleanupEffect(this)
      // 如果 effect 对象有 onStop 回调函数，就调用这个回调函数。这是为了在 effect 停止时执行一些用户定义的清理逻辑。
      if (this.onStop) {
        this.onStop()
      }
      // 将 active 属性设置为 false，表示当前的 effect 不再处于活跃状态。
      this.active = false
    }
  }
}

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
    // 创建effect时，立即执行一次回调函数。 建立响应式依赖关系。
    _effect.run()
  }

  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner
  runner.effect = _effect
  return runner
}

export const stopRunner = (runner: ReactiveEffectRunner) => {
  runner.effect.stop()
}

export let shouldTrack = true
const trackStack: boolean[] = []

/**
 * Temporarily pauses tracking.
 */
export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

/**
 * Re-enables effect tracking (if it was paused).
 */
export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

/**
 * Resets the previous global effect tracking state.
 */
export function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

/**
 * 用于在 effect（响应式副作用函数）与 dep（依赖集合）之间建立关联关系
 * @param effect
 * @param dep
 */
export function trackEffect(effect: ReactiveEffect, dep: Dep) {
  // 首先检查 dep 是否已经与 effect 建立了关联
  if (!dep.has(effect!)) {
    // 将副作用函数 effect 添加到存储副作用函数的🪣中
    dep.add(effect!)
    // dep 就是一个与当前副作用函数存在「联系」的依赖集合，将其添加到 activeEffect.deps数组中。 完成对依赖结合的收集。
    // 有了这个「联系」之后，每次执行副作用函数的时候，可以根据EffectFn.deps获取所有相关联的依赖集合，进而将副作用函数从依赖集合中移除。
    effect!.deps.push(dep)
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
