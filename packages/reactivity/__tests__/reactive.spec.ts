import { reactive } from '../src/reactive'

describe('reactive', () => {
  test('Object', () => {
    const original = { foo: 1 }
    const observed = reactive(original)

    expect(observed).not.toBe(original)

    // get
    expect(observed.foo).toBe(1)
  })
})
