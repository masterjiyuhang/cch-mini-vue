import { effect, track, trigger } from './effect'

export function computed(getter: () => any) {
  // 用来缓存上一次计算的值
  let value: any
  // dirty 标识位 用来标识是否需要重新计算值 为true则意味着 脏，需要计算
  let dirty = true
  const effectFn = effect(getter, {
    // 只有当调用值.value 的时候才执行
    lazy: true,
    // 添加调度器 在调度器中将 dirty 重置为 true
    // 如果没有这个调度器，修改依赖的值的时候，再次访问返回值不会发生变化
    // 因为第一次访问值的时候，变量dirty变成了false，没有重置为true，就不会重新计算
    // scheduler 会在getter 函数中所依赖的响应式数据发生变化的时候执行。
    // 这样就可以在数据发生变化的时候，将dirty重置为true，当下一次访问结果值的时候，就会重新调用effectFn进行计算，得到预期的结果
    scheduler() {
      dirty = true

      // 当计算属性依赖的响应式数据发生变化的时候，会执行调度函数，在调度函数中手动调用trigger函数，触发响应
      trigger(obj, 'value')
    }
  })

  const obj = {
    get value() {
      // 只有脏时才进行计算 并且将得到的值缓存到 value中
      if (dirty) {
        value = effectFn()
        // 将 dirty 设置为false， 下一次访问直接使用缓存的value值
        dirty = false
      }

      // 当读取value属性的时候，手动调用track进行函数追踪
      // 当读取一个计算属性的value时，手动调用track ，把计算属性返回对象obj作为target，同时作为第一个参数传递个track
      // 会建立 computed(obj) -> value -> effectFn 这样的关系
      track(obj, 'value')

      return value
    }
  }

  return obj
}
