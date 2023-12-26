import { isReactive, isReadonly, shallowReadonly } from '../src/reactive'

describe('shallowReadonly', () => {
  // 和 readonly() 不同，这里没有深层级的转换：只有根层级的属性变为了只读。
  // 属性的值都会被原样存储和暴露，这也意味着值为 ref 的属性不会被自动解包了。
  test('should not make non-reactive properties reactive', () => {
    const props = shallowReadonly({ n: { foo: 1 } })
    expect(isReadonly(props)).toBe(true)
    expect(isReadonly(props.n)).toBe(false)
    expect(isReactive(props.n)).toBe(false)
  })

  test('should make root level properties readonly', () => {
    const props = shallowReadonly({ n: 1 })
    props.n = 2
    expect(props.n).toBe(1)
  })

  test('should NOT make nested properties readonly', () => {
    const props = shallowReadonly({ n: { foo: 1 } })
    props.n.foo = 2
    expect(props.n.foo).toBe(2)
  })
})
