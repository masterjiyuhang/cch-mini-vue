import { reactive } from '../reactive'

describe('reactive', () => {
  it('happy path ', () => {
    const o1 = { foo: 1 }
    const observed = reactive(o1)
    expect(observed).not.toBe(o1)
    expect(observed.foo).toBe(1)
  })
})
