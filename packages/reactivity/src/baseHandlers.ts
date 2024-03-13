import {
  hasChanged,
  hasOwn,
  isArray,
  isIntegerKey,
  isObject,
  isSymbol,
  makeMap
} from '@cch-vue/shared'
import { pauseTracking, resetTracking } from './effect'
import {
  Target,
  reactive,
  reactiveMap,
  readonly,
  readonlyMap,
  shallowReactiveMap,
  shallowReadonlyMap,
  toRaw
} from './reactive'
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from './constants'
import { ITERATE_KEY, track, trigger } from './reactiveEffect'

const isNonTrackableKeys = makeMap(`__proto__,__v_isRef,__isVue`)

const builtInSymbols = new Set(
  /*#__PURE__*/
  Object.getOwnPropertyNames(Symbol)
    // ios10.x Object.getOwnPropertyNames(Symbol) can enumerate 'arguments' and 'caller'
    // but accessing them on Symbol leads to TypeError because Symbol is a strict mode
    // function
    .filter(key => key !== 'arguments' && key !== 'caller')
    .map(key => (Symbol as any)[key])
    .filter(isSymbol)
)

const arrayInstrumentations = createArrayInstrumentations()

function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {}
  // instrument identity-sensitive Array methods to account for possible reactive
  // values
  ;(['includes', 'indexOf', 'lastIndexOf'] as const).forEach(key => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      // this 是代理对象
      const arr = toRaw(this) as any
      for (let i = 0, l = this.length; i < l; i++) {
        track(arr, TrackOpTypes.GET, i + '')
      }
      // we run the method using the original args first (which may be reactive)
      // 在代理对象中查找，将结果存储到 res 中
      const res = arr[key](...args)
      if (res === -1 || res === false) {
        // if that didn't work, run it again using raw values.
        // res 为 false 说明没找到，通过 this.raw 拿到原始数组，再去其中查找并更新 res 值
        return arr[key](...args.map(toRaw))
      } else {
        return res
      }
    }
  })
  // instrument length-altering mutation methods to avoid length being tracked
  // which leads to infinite loops in some cases (#2137)
  // feat: avoid length mutating array methods causing infinite update
  ;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      pauseTracking()
      const res = (toRaw(this) as any)[key].apply(this, args)
      resetTracking()
      return res
    }
  })
  return instrumentations
}

function hasOwnProperty(this: object, key: string) {
  const obj = toRaw(this)
  track(obj, TrackOpTypes.HAS, key)
  return obj.hasOwnProperty(key)
}

/**
 * @description 用于定义代理对象的各种操作行为
 */
class BaseReactiveHandler implements ProxyHandler<Target> {
  // 用于指定是否为只读代理和是否为浅代理。
  constructor(
    protected readonly _isReadonly = false,
    protected readonly _shallow = false
  ) {}

  // 用于拦截对目标对象属性的读取操作
  get(target: Target, key: string | symbol, receiver: object) {
    // 首先获取构造函数中传入的 isReadonly 和 shallow 的值。
    const isReadonly = this._isReadonly
    const shallow = this._shallow

    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    }
    if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    }
    if (key === ReactiveFlags.IS_SHALLOW) {
      return shallow
    }
    if (key === ReactiveFlags.RAW) {
      if (
        receiver ===
          (isReadonly
            ? shallow
              ? shallowReadonlyMap
              : readonlyMap
            : shallow
              ? shallowReactiveMap
              : reactiveMap
          ).get(target) ||
        // receiver is not the reactive proxy, but has the same prototype
        // this means the reciever is a user proxy of the reactive proxy
        Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)
      ) {
        return target
      }
      // early return undefined
      return
    }

    const targetIsArray = isArray(target)

    // 非只读的时候才需要建立响应联系
    if (!isReadonly) {
      if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }
      if (key === 'hasOwnProperty') {
        return hasOwnProperty
      }
    }

    const res = Reflect.get(target, key, receiver) // target.key

    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }

    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }

    // 如果是浅响应，则直接返回原始值
    if (shallow) {
      return res
    }

    // 处理嵌套对象 递归地调用 readonly 将数据包装成只读的代理对象或响应式的代理对象
    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res)
    }

    // 返回具体的属性值
    return res
  }
}

class MutableReactiveHandler extends BaseReactiveHandler {
  constructor(shallow = false) {
    super(false, shallow)
  }
  set(target: Target, key: string | symbol, newVal: any, receiver: object) {
    let oldValue = (target as any)[key]

    // 如果属性不存在，则说明是在添加新的属性，否则是设置已有属性
    const hadKey =
      // 如果代理目标是数组，则检测被设置的索引值是否小于数组长度，如果是，则视作 SET 操作，否则是 ADD 操作
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key)

    // 如果放到hadKey之前 会影响hadKey的结果
    const res = Reflect.set(target, key, newVal, receiver)

    //  don't trigger if target is something up in the prototype chain of original
    // 只有当 receiver 是 target 的代理对象时才触发更新，这样就能屏蔽由原型引起的更 新，从而避免不必要的更新操作
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        // ADD
        trigger(target, TriggerOpTypes.ADD, key, newVal)
      }
      // 比较新旧值 只有发生变化的时候才出发响应式  注意⚠️： NaN !== NaN 为 true
      else if (hasChanged(newVal, oldValue)) {
        // SET
        trigger(target, TriggerOpTypes.SET, key, newVal)
      }
    }

    return res
  }

  deleteProperty(target: object, key: string | symbol): boolean {
    const hadKey = hasOwn(target, key)
    const oldValue = (target as any)[key]
    const result = Reflect.deleteProperty(target, key)
    if (result && hadKey) {
      trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
    }
    return result
  }

  has(target: Target, key: string | symbol) {
    const result = Reflect.has(target, key)
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, TrackOpTypes.HAS, key)
    }
    return result
  }

  ownKeys(target: object): (string | symbol)[] {
    // 在 ownKeys 拦截函 数内，判断当前操作目标 target 是否是数组，如果是，则使用 length 作为 key 去建立响应联系
    track(
      target,
      TrackOpTypes.ITERATE,
      isArray(target) ? 'length' : ITERATE_KEY
    )
    return Reflect.ownKeys(target)
  }
}

class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(shallow = false) {
    super(true, shallow)
  }

  set(target: object, key: string | symbol) {
    return true
  }

  deleteProperty(target: object, key: string | symbol) {
    return true
  }
}
export const mutableHandlers: ProxyHandler<object> =
  new MutableReactiveHandler()

export const readonlyHandlers: ProxyHandler<object> =
  new ReadonlyReactiveHandler()

export const shallowReadonlyHandlers: ProxyHandler<object> =
  new ReadonlyReactiveHandler(true)

export const shallowReactiveHandlers: ProxyHandler<object> =
  new MutableReactiveHandler(true)
