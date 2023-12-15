const bucket = new Set()

const data = {
  text: 'Cargo Tracking'
}

const obj = new Proxy(data, {
  get(target: any, key) {
    if (activeEffect) {
      bucket.add(activeEffect)
    }
    console.log(target[key], 'get...')
    return target[key]
  },
  set(target, key, value) {
    target[key] = value
    console.log(target[key], 'set ..')
    bucket.forEach((fn: any) => fn())
    return true
  }
})
let res = ''

// 定义一个全局变量 存储被注册的副作用函数
let activeEffect: any

// effect函数用于注册副作用函数
function effect(fn: any) {
  activeEffect = fn
  // 执行副作用函数 出发响应式数据的读取操作
  fn()
  // res = obj.text
}

// effect()
effect(() => {
  console.log('effect run')
  res = obj.text
})

setTimeout(() => {
  // obj.text = 'Read'
  obj.notExist = 'Read'
}, 1200)
