import {
  hasChanged,
  hasOwn,
  isArray,
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
import { track, trigger } from './reactiveEffect'

const arrayInstrumentations = createArrayInstrumentations()

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

function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {}
  // instrument identity-sensitive Array methods to account for possible reactive
  // values
  ;(['includes', 'indexOf', 'lastIndexOf'] as const).forEach(key => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      const arr = toRaw(this) as any
      for (let i = 0, l = this.length; i < l; i++) {
        track(arr, TrackOpTypes.GET, i + '')
      }
      // we run the method using the original args first (which may be reactive)
      const res = arr[key](...args)
      if (res === -1 || res === false) {
        // if that didn't work, run it again using raw values.
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

class BaseReactiveHandler implements ProxyHandler<Target> {
  constructor(
    protected readonly _isReadonly = false,
    protected readonly _shallow = false
  ) {}

  // 拦截读取操作
  get(target: Target, key: string | symbol, receiver: object) {
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
    if (!isReadonly) {
      if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }
      if (key === 'hasOwnProperty') {
        return hasOwnProperty
      }
    }

    const res = Reflect.get(target, key)

    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }

    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }

    if (shallow) {
      return res
    }

    // 处理嵌套对象
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
  set(target: Target, key: string | symbol, value: any) {
    let oldValue = (target as any)[key]
    const res = Reflect.set(target, key, value)
    const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    if (!hadKey) {
      // ADD
      trigger(target, TriggerOpTypes.ADD, key, value)
    } else if (hasChanged(value, oldValue)) {
      // SET
      trigger(target, TriggerOpTypes.SET, key, value)
    }
    return res
  }
}

class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(shallow = false) {
    super(true, shallow)
  }

  set(target: object, key: string | symbol) {
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
