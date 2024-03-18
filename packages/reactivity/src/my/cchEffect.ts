/**
 * 副作用函数
 * 拦截一个对象的读取和设置操作
 * 当读取的时候，把副作用函数存储起来
 * 当设置的时候，把副作用函数取出来执行
 */

const effectStack: any = [] // 5. 新增

// function cchEffect(fn: any) {
//   // 当调用 effect 注册副作用函数的时候 将副作用函数fn赋值给 activeEffect
//   activeEffect = fn

//   // 执行副作用函数 触发响应式数据的操作 进而触发代理对象Proxy的get拦截函数
//   fn()
// }
function cchEffect(fn: any, options?: any) {
  const effectFn: any = () => {
    // 每次副作用函数执行时，先把它从所有与之关联的依赖集合中删除 调用 cleanup 函数完成清除工作 cleanup(effectFn) // 新增
    cleanup(effectFn)
    // activeEffect = fn
    // 当 effectFn 执行时，将其设置为当前激活的副作用函数
    activeEffect = effectFn
    // 在副作用函数执行时，将当前副作用函数压入栈中，待副作用函数执 行完毕后将其从栈中弹出
    effectStack.push(effectFn) // 5. 新增
    fn()
    effectStack.pop() // 5. 新增
    // 始终让 activeEffect 指向栈顶的副作 用函数
    activeEffect = effectStack[effectStack.length - 1] // 5. 新增
  }
  // 将 options 挂载到 effectFn 上
  effectFn.options = options // 7. 新增（1）
  // activeEffect.deps 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = []

  effectFn()
}

/**
 * 接受副作用函数作为参数，
 * 遍历副作用函数的effectFn.deps数组，
 * 该数组的每一项都是一个依赖集合，
 * 然后将该副作用函数从依赖集合中移除，
 * 最后重置 effectFn.deps 数组。
 * @param effectFn
 */
function cleanup(effectFn: any) {
  for (let index = 0; index < effectFn.deps.length; index++) {
    const deps = effectFn.deps[index]
    deps.delete(effectFn)
  }
  effectFn.deps.length = 0
}

// const bucket = new Set()
/**
 * 为什么是WeackMap
 * WeakMap 对 key 是弱引用，不影响垃圾回收器的工作。
 * 一旦 key 被垃圾回收器回收，那么对应的键和 值就访问不到了。
 */
const bucket = new WeakMap() // WeakMap由target --> Map构成

/**
 * 一个响应系统的工作流程如下:
 * 当 读取 操作发生时，将副作用函数收集到“桶”中;
 * 当 设置 操作发生时，从“桶”中取出副作用函数并执行。
 */

// 用一个全局变量存储被注册的副作用函数
let activeEffect: any
function reactive(obj: any) {
  return new Proxy(obj, {
    get(target, key) {
      // // 1.初始化拦截操作
      // // bucket.add(cchEffect)
      // // 2. 进一步优化 使得响应式系统不依赖副作用函数的名字
      // if (activeEffect) {
      //   bucket.add(activeEffect)
      // }

      track(target, key)
      // 返回属性值
      return Reflect.get(target, key)
    },
    set(target, key, value) {
      // 设置属性的值
      const res = Reflect.set(target, key, value)
      trigger(target, key)

      return res
    }
  })
}

// 函数的名字叫 track 是为了表达 的含义
function track(target: any, key: string | number | symbol) {
  // 3. 没有副作用函数 直接return
  if (!activeEffect) return
  // 从🪣中取得 depsMap 它也是一个Map类型 类型： key --> effects
  let depsMap = bucket.get(target)
  // 如果不存在 depsMap，那么新建一个 Map 并与 target 关联
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }
  let deps = depsMap.get(key)
  //  如果 deps 不存在，同样新建一个 Set 并与 key 关联
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  // 最后将当前激活的副作用函数添加到🪣里
  deps.add(activeEffect)

  // 4. 新增 deps就是一个与当前副作用函数存在联系的依赖集合
  // 将其添加到 activeEffect.deps 数组中
  activeEffect.deps.push(deps) // 4. 新增
}

function trigger(target: any, key: string | symbol) {
  // throw new Error('Function not implemented.')
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  // const effectsToRun = new Set(effects)
  const effectsToRun = new Set() // 6.  新增
  // 6. 新增 避免递归操作 可以通过分析递归产生的原因发现，读取和设置操作是在同一个副作用函数内进行的。 无论是 track 时收集的副 作用函数，还是 trigger 时要触发执行的副作用函数，都是 activeEffect。
  // 基于此 我们可以在 trigger 动作发生时增加守卫条件： 如果 trigger 触发执行的副作用函数和当前正在执行的副作用函数相同，不处罚执行。
  effects &&
    effects.forEach((effectFn: any) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  // effectsToRun.forEach((effectFn: any) => effectFn())

  // 7. 新增（2）
  effectsToRun.forEach((effectFn: any) => {
    // 如果一个副作用函数存在调度器，则调用该调度器，并将副作用函数作为参数传递进去
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
  // 语言规范中对此有明确的说明:在调用 forEach 遍历 Set 集合时，
  // 如果一个值已经被访问过了，但该值被删除并重新添加到集合， 如果此时 forEach 遍历没有结束，那么该值会重新被访问。
  // 解决办法很简单，我们可以构造另外一个 Set 集合并遍历它
  // effects &&
  //   effects.forEach((element: () => void) => {
  //     element()
  //   })
}
/**
 * 下面代码 effect run... 会执行两次
 * 造成执行三次的原因是
 * 我们用于存储副作用函数的🪣是有问题的，没有在副作用函数与被操作的目标字段之间建立明确的联系。
 *
 * 当读取属性时，无论读取的是哪一个属性，其实都会把副作用函数放到🪣里，设置操作时，也都会把🪣里面的副作用函数去除来执行。
 * 简单来说，就是副作用函数与被操作字段之间没有关联。
 *
 * 解决方案：
 * 把🪣由Set转换成Map
 */
// const obj = reactive({ name: 'erhang' })

// 在这段代码里面存在三个角色. 1. 被操作的代理对象 obj 2. 被操作的字段名name 3. 使用 cchEffect函数注册的副作用函数 () => {...}
//                       1. target 来代表一个代理对象所代理的原始对象。 2. key 表示被操作的字段名 3. effectFn 来表示被注册的副作用函数
// 可以建立如下关系：
// target --> key --> effectFn

// cchEffect(() => {
//   console.log('effect run...')
//   const name = obj.name
//   console.log(name)
// })

// setTimeout(() => {
//   obj.no = 'qwe'
// }, 1000)

/**
 *  建立关联关系的例子
 *
 *  effect(() => { obj.name })
 *  effect(() => { obj.name })
 *  target
 *       --> name
 *            --> effectFn1
 *            --> effectFn2
 *
 * effect(() => { obj.name1  obj.name2 })
 *  target
 *       --> name1
 *            --> effectFn1
 *       --> name2
 *            --> effectFn2
 *
 *  effect(() => { obj1.name })
 *  effect(() => { obj2.name })
 *  target1
 *       --> name
 *            --> effectFn1
 *  target2
 *       --> name
 *            --> effectFn2
 */

// 建立正确的关联关系后 可以看到只执行了一次 effect run...
const original = { name: 'cch', age: 2 }
cchEffect(() => {
  console.log('effect run...')
  console.log(original.name)
})

setTimeout(() => {
  original.age = 11
}, 1000)

/**
 * 4. 副作用函数 分支切换 与 cleanup
 *
 * 简单来说就是处理遗留的副作用函数
 * 当副作用函数执行完毕后，会重新建立联系，但在新的联系中不会包含遗留的副作用函数。
 * 所以，如果我们能做到每次副作用函数执行前，将其从相关联的依赖集合中移除，那么问题就迎刃而解了。
 */

/**
 * 5. 嵌套的 effect 和 effect 栈
 * effect(function effectFn1() {
 *    effect(function effectFn2() {
 *    })
 *  })
 */

/**
 * 6. 避免无限递归
 *  副作用函数正在执行中，还没有执行完毕，就要开始下一次的执行
 * effect(() => {
 *    obj.foo++
 *    // obj.foo = obj.foo + 1 // 既会读取 obj.foo 的值，又会设置 obj.foo 的 值，而这就是导致问题的根本原因
 * })
 */

/**
 * 7. 调度执行
 *
 * 什么是可调度性
 *
 * 当 trigger 动作触发副作用函数重新执行时，有能力决定副作用函数的执行时机，次数和方式。
 */

const adj1 = { foo: 1, boo: 1 }
const adj1Reactive = reactive(adj1)

cchEffect(() => console.log(adj1Reactive.foo))

adj1Reactive.foo++

console.log('结束了')
// 执行结果：
// 1
// 2
// 结束了

// 如果我希望执行结果变成：
// 1
// 结束了
// 2
// 我应该怎么办？
cchEffect(() => console.log('scheduler..', adj1Reactive.boo), {
  // 指定 scheduler 调度函数
  scheduler(fn: () => void) {
    setTimeout(() => {
      fn()
    }, 0)
  }
})

adj1Reactive.boo++

console.log('结束了 scheduler...')
