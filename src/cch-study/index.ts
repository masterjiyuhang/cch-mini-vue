const reactiveCCH = (val) => {
    return new Proxy(val, {
        get(target, key) {
            track(target, key)
            return Reflect.get(target, key)
        },
        set(target, key, value) {
            trigger(target, key)
            return Reflect.set(target, key, value)
        },
    })
}

class ReactiveEffectCCH {
    private _fn: any
    constructor(fn) {
        this._fn = fn
    }
    run() {
        activeEffect = this
        console.log('立即执行effect传进来的方法')
        this._fn() // 调用函数时会触发reactive的get操作
    }
}

// 全局的变量 将当前的执行的effect赋值给它
let activeEffect
const effectCCH = (fn) => {
    const _effect = new ReactiveEffectCCH(fn)

    _effect.run()
}

const targetMap = new Map()
const track = (target, key) => {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
        depsMap = new Map()
        targetMap.set(target, depsMap)
    }

    let dep = depsMap.get(key)
    if (!dep) {
        dep = new Set()
        depsMap.set(key, dep)
    }

    if (!activeEffect) return

    dep.add(activeEffect)
}

const trigger = (target, key) => {
    let dep = targetMap.get(target).get(key)

    for (const e of dep) {
        e.run()
    }
}

// 以下时测试代码
const defaultPerson = {
    age: 10,
    name: '纪宇航',
}
const jyh = reactiveCCH(defaultPerson)
console.log(jyh.age, '测试reactive方法的使用')

let age_2023

effectCCH(() => {
    age_2023 = jyh.age + 1
})

console.log(age_2023, '测试effect立即执行传进来的方法')

jyh.age++
jyh.age++
jyh.age++

console.log(jyh, jyh.age, age_2023, '测试响应式方法')
