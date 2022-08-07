import { extend } from '../shared'

class ReactiveEffect {
  private _fn: any
  public scheduler: any

  stopIsActive = true
  onStop?: () => void
  deps = []
  constructor(fn, scheduler?) {
    this._fn = fn // 传进来的方法
  }

  run() {
    activeEffect = this
    // this._fn() // tips: 初始时没有考虑到需要返回返回值

    // 调用effect时，立即执行传进来的方法，并将方法执行的结果返回
    return this._fn()
  }

  stop() {
    //   清空deps里面的effect

    // this.deps.forEach((item: any) => {
    //   item.delete(this)
    // })
    if (this.stopIsActive) {
      cleanupEffect(this)

      if (this.onStop) {
        this.onStop()
      }
      this.stopIsActive = false
    }
  }
}

function cleanupEffect(effect) {
  effect.deps.forEach((element: any) => {
    element.delete(effect)
  })
}

const targetMap = new Map()

// 收集依赖
export const track = (target, key) => {
  // 对象里面的每一个key值需要一个依赖收集的容器
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }

  let dep = depsMap.get(key)
  if (!dep) {
    dep = new Set()
    depsMap.set(key, dep)
  }

  if (!activeEffect) return

  dep.add(activeEffect)
  activeEffect.deps.push(dep)
}

export const trigger = (target, key) => {
  let depsMap = targetMap.get(target)
  let dep = depsMap.get(key)

  for (const effect of dep) {
    // scheduler 的实现 当有 scheduler 时执行
    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  }
}

let activeEffect

// 将传入的函数转化为reactiveEffect格式的函数
export const effect = (fn, options: any = {}) => {
  const _effect = new ReactiveEffect(fn, options.scheduler)

  //  options
  //   Object.assign(_effect, options)
  extend(_effect, options)

  _effect.run()

  // return _effect.run.bind(_effect) // 是需要有一个fn执行结果的返回值的
  const runner: any = _effect.run.bind(_effect)
  runner.effect = _effect // 给runner的effect赋值，这样可以在stop里面调用它

  return runner

  //   墨迹写法
  //   返回一个runner，调用这个runner的时候会再次执行传进effect的fn
  //   调用fn的时候，会把fn的返回值返回出去
  //   return () => {
  //     const res = _effect.run()
  //     return res
  //   }
}

export const stop = (runner) => {
  runner.effect.stop()
}
