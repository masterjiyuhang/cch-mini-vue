import { track, trigger } from './effect'

export const reactive = (raw) => {
  // 通过proxy做代理，做的一个拦截操作

  return new Proxy(raw, {
    get(target, key) {
      const res = Reflect.get(target, key)

      // 依赖收集  track
      track(target, key)

      return res
    },

    set(target, key, val) {
      const res = Reflect.set(target, key, val)

      // 触发依赖
      trigger(target, key)

      return res
    },
  })
}
