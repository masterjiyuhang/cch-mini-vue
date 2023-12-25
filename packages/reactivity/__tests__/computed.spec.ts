import { computed } from '../src/computed'
import { effect } from '../src/effect'
import { reactive } from '../src/reactive'

describe('computed', () => {
  it('start', () => {
    const data = { foo: 1, nar: 2 }

    const obj = reactive(data)
    const fn = vi.fn(() => obj.foo + obj.nar)
    const sumRes = computed(fn)

    expect(sumRes.value).toBe(3)
    expect(sumRes.value).toBe(3)
    expect(sumRes.value).toBe(3)
    // 判断缓存属性 AssertionError: expected "spy" to be called 1 times, but got 3 times
    // dirty + value 实现缓存
    expect(fn).toHaveBeenCalledTimes(1)

    obj.foo = 2
    // scheduler 实现依赖值变化时 重新计算
    expect(sumRes.value).toBe(4)

    const spy = vi.fn(() => {
      console.log(sumRes.value, '看看')
    })

    effect(spy)
    // 如果当 obj.foo 的值发生变化时，并不会触发这个spy函数重新执行，就是一个缺陷
    obj.foo++
    expect(spy).toHaveBeenCalledTimes(2)
    // scheduler 实现依赖值变化时 重新计算
    expect(sumRes.value).toBe(5)
  })
})
