import { effect } from '../src/effect'
import { reactive } from '../src/reactive'

describe('reactive/effect', () => {
  test('first', () => {
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
})
