import { effect } from './../effect'
import { reactive } from './../reactive'
describe('effect', () => {
  it('happy path', () => {
    const user = reactive({
      age: 10,
    })

    let nextAge

    effect(() => {
      nextAge = user.age + 1
    })

    expect(nextAge).toBe(11)

    // update
    user.age++
    user.age++
    user.age++

    expect(nextAge).toBe(14)
  })

  it('should return runner when call effect', () => {
    let foo = 1
    const runner = effect(() => {
      foo++
      console.log(foo)
      return 'HELLO WORLD'
    })

    expect(foo).toBe(2)
    const res = runner()
    expect(foo).toBe(3)
    expect(res).toBe('HELLO WORLD')
  })
})
