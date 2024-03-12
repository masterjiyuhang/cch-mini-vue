import { reactive } from '../src/reactive'
import { ref } from '../src/ref'
import { watch } from '../src/watch'

describe('test watch', () => {
  test('init watch', () => {
    const original = { name: 'erhang' }
    const obj = reactive(original)
    const fn = vi.fn(() => {})
    const fn1 = vi.fn(() => {})

    watch(obj, fn)
    watch(() => obj.name, fn1)

    obj.name = 'cch'
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledTimes(1)
  })

  test('watch oldValue, newValue', () => {
    const original = { name: 'erhang' }
    let newVal, oldVal
    const obj = reactive(original)
    const fn = vi.fn((newValue, oldValue) => {
      newVal = newValue
      oldVal = oldValue
    })

    watch(() => obj.name, fn)

    obj.name = 'cch'
    expect(newVal).toEqual('cch')
    expect(oldVal).toEqual('erhang')
  })

  it('cleanup registration (with source)', async () => {
    const count = ref(0)
    const cleanup = vi.fn()
    let dummy

    watch(count, (count, prevCount, onCleanup) => {
      onCleanup(cleanup)
      dummy = count
    })

    count.value++
    expect(cleanup).toHaveBeenCalledTimes(0)
    expect(dummy).toBe(1)
  })
})
