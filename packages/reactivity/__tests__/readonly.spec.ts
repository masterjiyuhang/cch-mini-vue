import { isReactive, isReadonly, readonly } from '../src/reactive'

describe('readonly', () => {
  describe('Object', () => {
    it('should make nested values readonly', () => {
      const original = { foo: 1, bar: { baz: 2 } }
      const wrapped = readonly(original)

      expect(wrapped).not.toBe(original)
      expect(isReactive(wrapped)).toBe(false)
      expect(isReadonly(wrapped)).toBe(true)

      expect(isReactive(original)).toBe(false)
      expect(isReadonly(original)).toBe(false)

      expect(isReactive(wrapped.bar)).toBe(false)
      expect(isReadonly(wrapped.bar)).toBe(true)

       // get
       expect(wrapped.bar.baz).toBe(2)
    })
  })
})
