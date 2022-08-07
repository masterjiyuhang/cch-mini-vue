import { effect, stop } from './../effect'
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

        expect(nextAge).toBe(12)
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

    it('scheduler', () => {
        // 1. 通过effect 的第二个参数给定一个scheduler 的 fn
        // 2. effect 第一次执行的时候 还会执行fn
        // 3. 当响应式对象 进行set update 的时候 不会执行fn 而是执行scheduler
        // 4. 当执行 runner 的时候， 会再次执行fn

        let dummy
        let run: any
        const scheduler = jest.fn(() => {
            run = runner
        })
        const obj = reactive({ foo: 1 })
        const runner = effect(
            () => {
                dummy = obj.foo
            },
            { scheduler }
        )
        expect(scheduler).not.toHaveBeenCalled()
        // effect第一次执行的之后 还会执行传入进去的fn
        expect(dummy).toBe(1)
        // should be called on first trigger
        obj.foo++
        expect(scheduler).toHaveBeenCalledTimes(1)
        // should not run yet
        expect(dummy).toBe(1)
        // manually run   当执行 runner 的时候， 会再次执行fn
        run()
        // should have run
        expect(dummy).toBe(2)
    })

    it('stop', () => {
        let dummy
        const obj = reactive({ prop: 1 })
        const runner = effect(() => {
            dummy = obj.prop
        })
        obj.prop = 2
        expect(dummy).toBe(2)
        stop(runner)
        obj.prop = 3
        expect(dummy).toBe(2)

        // stopped effect should still be manually callable
        runner()
        expect(dummy).toBe(3)
    })

    it('events: onStop', () => {
        const onStop = jest.fn()
        const runner = effect(() => {}, {
            onStop,
        })

        stop(runner)
        expect(onStop).toHaveBeenCalled()
    })
})
