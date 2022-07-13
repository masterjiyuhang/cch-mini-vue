class ReactiveEffect {
  private _fn: any
  constructor(fn) {
    this._fn = fn // 传进来的方法
  }

  run() {
    activeEffect = this
    // this._fn() // tips: 初始时没有考虑到需要返回返回值

    // 调用effect时，立即执行传进来的方法，并将方法执行的结果返回
    return this._fn()
  }
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

  dep.add(activeEffect)
}

export const trigger = (target, key) => {
  let depsMap = targetMap.get(target)
  let dep = depsMap.get(key)

  for (const item of dep) {
    item.run()
  }
}

let activeEffect

export const effect = (fn) => {
  const _effect = new ReactiveEffect(fn)
  _effect.run()

  //   _effect.run.bind(_effect) 是需要有一个fn执行结果的返回值的
  return _effect.run.bind(_effect)

  //   墨迹写法
  //   返回一个runner，调用这个runner的时候会再次执行传进effect的fn
  //   调用fn的时候，会把fn的返回值返回出去
  //   return () => {
  //     const res = _effect.run()
  //     return res
  //   }
}
