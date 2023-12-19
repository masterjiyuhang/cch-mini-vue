import { effect } from '../src/effect'
import { reactive } from '../src/reactive'

describe('reactive/effect', () => {
  test('should observe basic properties', () => {
    const user = reactive({
      age: 10
    })

    let nextAge

    effect(() => {
      nextAge = user.age + 10
    })

    expect(nextAge).toBe(20)

    user.age += 10

    expect(nextAge).toBe(30)
  })

  it('should observe multiple properties', () => {
    let dummy
    const counter = reactive({ num1: 0, num2: 0 })
    effect(() => (dummy = counter.num1 + counter.num1 + counter.num2))

    expect(dummy).toBe(0)
    counter.num1 = counter.num2 = 7
    expect(dummy).toBe(21)
  })

  it('should handle multiple effects', () => {
    let dummy1, dummy2
    const counter = reactive({ num: 0 })
    effect(() => (dummy1 = counter.num))
    effect(() => (dummy2 = counter.num))

    expect(dummy1).toBe(0)
    expect(dummy2).toBe(0)
    counter.num++
    expect(dummy1).toBe(1)
    expect(dummy2).toBe(1)
  })
})
