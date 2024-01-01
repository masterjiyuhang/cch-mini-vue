import { effect } from '../src/effect'
import { ref } from '../src/ref'

describe('ssw', () => {
  test('qwejqe', () => {
    expect('qwe' + 'qwe').toBe('qweqwe')
  })

  it('should hold a value', () => {
    const a = ref(1)
    expect(a.value).toBe(1)
    a.value = 2
    expect(a.value).toBe(2)
  })

  it('should be reacitve', () => {
    const a = ref(1)
    let dummy
    const fn = vi.fn(() => {
      dummy = a.value
    })
    effect(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(dummy).toBe(1)

    // obj string  ... obj. str.value

    // test reactive behavior
    a.value = 2
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should make nested properties reactive', () => {
    const a = ref({
      count: 1
    })
    let dummy
    effect(() => {
      dummy = a.value.count
    })
    expect(dummy).toBe(1)
    a.value.count = 2
    expect(dummy).toBe(2)
  })
})

// {obj: 1}

// {}.obj

// let str = ref(1)
// ref(1) -> toRaw -> 1
// str.value // ref
