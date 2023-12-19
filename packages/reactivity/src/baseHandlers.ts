import { isObject } from '@cch-vue/shared'
import { track, trigger } from './effect'
import {
  ReactiveFlags,
  Target,
  reactive,
  reactiveMap,
  readonly,
  readonlyMap,
  shallowReactiveMap,
  shallowReadonlyMap
} from './reactive'

class BaseReactiveHandler implements ProxyHandler<Target> {
  constructor(
    protected readonly _isReadonly = false,
    protected readonly _shallow = false
  ) {}

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

    // TODO target is Array
    if (!isReadonly) {
    }

    const res = Reflect.get(target, key)

    if (!isReadonly) {
      track(target, key)
    }

    // 处理嵌套对象
    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res)
    }
    return res
  }
}

class MutableReactiveHandler extends BaseReactiveHandler {
  constructor(readonly = false, shallow = false) {
    super(readonly, shallow)
  }
  set(target: Target, key: string | symbol, value: any) {
    const res = Reflect.set(target, key, value)

    trigger(target, key, value)
    return res
  }
}

class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(readonly = true, shallow = false) {
    super(readonly, shallow)
  }

  set(target: object, key: string | symbol) {
    return true
  }
}
export const mutableHandlers: ProxyHandler<object> =
  new MutableReactiveHandler()

export const readonlyHandlers: ProxyHandler<object> =
  new ReadonlyReactiveHandler()
