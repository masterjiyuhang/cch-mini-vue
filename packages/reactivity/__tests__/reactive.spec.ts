import { isReactive, reactive, toRaw } from '../src/reactive'

describe('reactive', () => {
  test('Object', () => {
    const original = { foo: 1 }
    const observed = reactive(original)

    expect(observed).not.toBe(original)

    // get
    expect(observed.foo).toBe(1)
  })

  test('nested reactives', () => {
    const original = {
      nested: {
        foo: 1
      }
    }
    const observed = reactive(original)

    expect(isReactive(observed.nested)).toBe(true)
  })

  it('isReactive', () => {
    const data = reactive({ foo: 'bar' })
    expect(isReactive(data)).toBe(true)
  })

  it('toRaw', () => {
    const original = { foo: 1 }
    const observed = reactive(original)
    expect(toRaw(original)).toBe(original)
    expect(toRaw(observed)).toBe(original)
  })
})
