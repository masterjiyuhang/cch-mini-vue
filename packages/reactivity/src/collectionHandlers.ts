import { hasChanged, hasOwn, isMap } from '@cch-vue/shared'
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from './constants'
import { toRaw, toReactive, toReadonly } from './reactive'
import {
  ITERATE_KEY,
  MAP_KEY_ITERATE_KEY,
  track,
  trigger
} from './reactiveEffect'

type CollectionTypes = IterableCollections | WeakCollections

type IterableCollections = Map<any, any> | Set<any>
type WeakCollections = WeakMap<any, any> | WeakSet<any>
type MapTypes = Map<any, any> | WeakMap<any, any>
type SetTypes = Set<any> | WeakSet<any>

const toShallow = <T extends unknown>(value: T): T => value

const getProto = <T extends CollectionTypes>(v: T): any =>
  Reflect.getPrototypeOf(v)

/**
 * @description 从目标对象中获取对应的值 并在需要时追踪其访问操作
 * @param target 要获取值的目标对象，其类型为 MapTypes。
 * @param key 要获取的值的键，类型为 unknown，表示未知类型。
 * @param isReadonly 一个布尔值，表示目标对象是否为只读的，默认为 false。
 * @param isShallow 一个布尔值，表示是否使用浅包装，默认为 false。
 * @returns
 */
function get(
  target: MapTypes,
  key: unknown,
  isReadonly = false,
  isShallow = false
) {
  // 首先将目标对象 target 转换为其原始值（去除了响应式包装的值）。
  target = (target as any)[ReactiveFlags.RAW]
  const rawTarget = toRaw(target)
  const rawKey = toRaw(key)

  // 如果 isReadonly 不为 true，则表示目标对象不是只读的
  if (!isReadonly) {
    // 使用 hasChanged() 函数比较原始键和当前键，如果键发生变化，则追踪访问操作
    if (hasChanged(key, rawKey)) {
      track(rawTarget, TrackOpTypes.GET, key)
    }
    // 使用 track() 函数追踪目标对象的访问操作。
    track(rawTarget, TrackOpTypes.GET, rawKey)
  }

  // 获取目标对象的原型对象，并从中提取 has 方法。
  const { has } = getProto(rawTarget)

  // 根据 isShallow 和 isReadonly 的值选择包装函数。
  const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive

  // 检查目标对象是否包含键 key
  if (has.call(rawTarget, key)) {
    // 如果是，则返回对应的值，并应用选定的包装函数
    return wrap(target.get(key))
  }
  // 如果目标对象不包含 key，但原始目标对象包含原始键 rawKey，则以相同的方式获取对应的值
  else if (has.call(rawTarget, rawKey)) {
    return wrap(target.get(rawKey))
  }
  // 如果目标对象和原始目标对象不相等，则获取键 key 对应的值（可能触发嵌套响应式对象的追踪操作，但并未返回）
  else if (target !== rawTarget) {
    // #3602 readonly(reactive(Map))
    // ensure that the nested reactive `Map` can do tracking for itself
    target.get(key)
  }
}

/**
 * 检查目标对象是否包含指定键
 * @param this 函数的上下文类型，表示函数中的 this 对象必须是 CollectionTypes 类型或其子类型。
 * @param key 要检查的键，类型为 unknown，表示未知类型。
 * @param isReadonly 一个布尔值，表示目标对象是否为只读的，默认为 false。
 * @returns
 */
function has(this: CollectionTypes, key: unknown, isReadonly = false): boolean {
  // 这几行代码首先将函数的上下文对象（this）转换为其原始值（去除了响应式包装的值）
  const target = (this as any)[ReactiveFlags.RAW]
  const rawTarget = toRaw(target)
  const rawKey = toRaw(key)

  // 追踪访问操作
  if (!isReadonly) {
    // 使用 hasChanged() 函数比较原始键和当前键，如果键发生变化，则追踪访问操作。
    if (hasChanged(key, rawKey)) {
      track(rawTarget, TrackOpTypes.HAS, key)
    }
    // 使用 track() 函数追踪目标对象的访问操作。
    track(rawTarget, TrackOpTypes.HAS, rawKey)
  }

  // 如果键 key 与原始键 rawKey 相等，则直接调用 target.has(key) 来检查目标对象是否包含该键。 否则，分别检查目标对象是否包含键 key 或者原始键 rawKey，并返回逻辑或的结果。
  return key === rawKey
    ? target.has(key)
    : target.has(key) || target.has(rawKey)
}

/**
 * @description 用于获取目标对象的元素个数
 * @param target 要统计的对象 一个可迭代的集合（实现了 IterableCollections 接口）
 * @param isReadonly 对象是否是只读的  默认为false
 * @returns
 */
function size(target: IterableCollections, isReadonly = false) {
  // 将 target 对象的原始值赋值给 target 变量
  target = (target as any)[ReactiveFlags.RAW]

  // 如果不是只读的 执行 track ，TrackOpTypes.ITERATE 表示迭代操作的类型，用于跟踪迭代操作的依赖。ITERATE_KEY 是一个特殊的标识符，用于表示迭代操作的键。
  !isReadonly && track(toRaw(target), TrackOpTypes.ITERATE, ITERATE_KEY)

  // 使用 Reflect.get() 方法从 target 对象中获取名为 'size' 的属性值
  return Reflect.get(target, 'size', target)
}

function add(this: SetTypes, value: unknown) {
  value = toRaw(value)
  const target = toRaw(this)
  const proto = getProto(target)
  const hadKey = proto.has.call(target, value)
  if (!hadKey) {
    target.add(value)
    trigger(target, TriggerOpTypes.ADD, value, value)
  }
  return this
}

/**
 * 向 Map 类型的对象设置键值对，并在需要时触发相应的响应式更新操作
 * @param this
 * @param key
 * @param value
 * @returns
 */
function set(this: MapTypes, key: unknown, value: unknown) {
  // 将传入的 value 参数转换为其原始值，去除了响应式包装
  value = toRaw(value)
  // 将当前方法的上下文对象（this）转换为其原始值，去除了响应式包装。
  const target = toRaw(this)

  // 使用 getProto() 函数获取目标对象的原型对象，并从中解构出 has 和 get 方法， has 方法用于检查目标对象是否包含指定键，get 方法用于获取目标对象指定键的值。
  const { has, get } = getProto(target)

  // 使用 has 方法检查目标对象是否包含指定的键 key。
  let hadKey = has.call(target, key)

  // 如果目标对象不包含 key，则将 key 转换为其原始值，并再次检查目标对象是否包含原始键。
  if (!hadKey) {
    key = toRaw(key)
    hadKey = has.call(target, key)
  }
  // 最终确定 hadKey 变量的值，表示键是否存在。

  // 获取旧值并设置新值
  const oldValue = get.call(target, key)
  target.set(key, value)

  // 触发响应式更新操作
  if (!hadKey) {
    // 如果键是新增的（即之前目标对象不包含该键），则触发 ADD 类型的响应式更新操作
    trigger(target, TriggerOpTypes.ADD, key, value)
  } else if (hasChanged(value, oldValue)) {
    // 如果新值与旧值不相等，则触发 SET 类型的响应式更新操作，并传入新值和旧值作为参数。
    trigger(target, TriggerOpTypes.SET, key, value, oldValue)
  }
  return this
}

function deleteEntry(this: CollectionTypes, key: unknown) {
  const target = toRaw(this)
  const { has, get } = getProto(target)
  let hadKey = has.call(target, key)
  if (!hadKey) {
    key = toRaw(key)
    hadKey = has.call(target, key)
  }

  const oldValue = get ? get.call(target, key) : undefined
  // forward the operation before queueing reactions
  const result = target.delete(key)
  if (hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

function clear(this: IterableCollections) {
  const target = toRaw(this)
  const hadItems = target.size !== 0
  const oldTarget = undefined
  // forward the operation before queueing reactions
  const result = target.clear()
  if (hadItems) {
    trigger(target, TriggerOpTypes.CLEAR, undefined, undefined, oldTarget)
  }
  return result
}

function createForEach(isReadonly: boolean, isShallow: boolean) {
  return function forEach(
    this: IterableCollections,
    callback: Function,
    thisArg?: unknown
  ) {
    // 将当前对象（this）强制转换为 observed，并从中获取原始值 target。
    const observed = this as any
    const target = observed[ReactiveFlags.RAW]

    // 使用 toRaw() 函数获取 target 的原始值，并将其保存在 rawTarget 中。
    const rawTarget = toRaw(target)

    // 根据 isShallow 和 isReadonly 的值选择适当的包装函数，分别是 toShallow、toReadonly 或 toReactive。
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive

    // 如果对象不是只读的，则调用 track() 函数追踪目标对象的迭代操作。
    !isReadonly && track(rawTarget, TrackOpTypes.ITERATE, ITERATE_KEY)

    // 调用目标对象的 forEach() 方法，在每个元素上执行回调函数。
    return target.forEach((value: unknown, key: unknown) => {
      // important: make sure the callback is
      // 1. invoked with the reactive map as `this` and 3rd arg
      // 2. the value received should be a corresponding reactive/readonly.

      // 确保将回调函数作为 thisArg 传递给 call() 方法，以便确保在回调函数中 this 指向正确。
      // 为了确保回调函数接收到的值是响应式或只读的，对每个值和键都应用适当的包装函数 wrap()
      // 最后，将 observed 对象传递给回调函数作为第三个参数，以便在回调函数中可以访问到原始的响应式对象。
      return callback.call(thisArg, wrap(value), wrap(key), observed)
    })
  }
}

interface Iterable {
  [Symbol.iterator](): Iterator
}

interface Iterator {
  next(value?: any): IterationResult
}

interface IterationResult {
  value: any
  done: boolean
}

/**
 * 创建可迭代方法
 * @param method 表示要创建的可迭代方法的名称，可以是字符串或符号。
 * @param isReadonly 一个布尔值，表示目标对象是否为只读的。
 * @param isShallow 一个布尔值，表示是否浅包装。
 * @returns
 */
function createIterableMethod(
  method: string | symbol,
  isReadonly: boolean,
  isShallow: boolean
) {
  // 返回一个匿名函数，这个匿名函数就是我们要解释的可迭代方法。
  return function (
    this: IterableCollections,
    ...args: unknown[]
  ): Iterable & Iterator {
    // 将当前对象（this）强制转换为原始值 target。
    const target = (this as any)[ReactiveFlags.RAW]
    // 使用 toRaw() 函数获取 target 的原始值，并将其保存在 rawTarget 中。
    const rawTarget = toRaw(target)
    // 使用 isMap() 函数判断 target 是否为 Map 类型。
    const targetIsMap = isMap(rawTarget)
    // 根据 method 的不同值，确定是否要返回键值对、仅键或其他。
    const isPair =
      method === 'entries' || (method === Symbol.iterator && targetIsMap)
    const isKeyOnly = method === 'keys' && targetIsMap

    // 调用目标对象的相应方法（如 entries、keys 等），并将参数 args 传递给该方法，得到一个内部迭代器 innerIterator。
    const innerIterator = target[method](...args)
    // 根据 isShallow 和 isReadonly 的值选择适当的包装函数，分别是 toShallow、toReadonly 或 toReactive。
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive
    // 如果目标对象不是只读的，则调用 track() 函数追踪目标对象的迭代操作。
    !isReadonly &&
      track(
        rawTarget,
        TrackOpTypes.ITERATE,
        isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
      )
    // return a wrapped iterator which returns observed versions of the
    // values emitted from the real iterator
    // 返回一个对象，该对象实现了可迭代协议和迭代器协议。
    return {
      // iterator protocol
      // next() 方法用于迭代下一个值，对内部迭代器 innerIterator 调用 next() 方法，并根据情况对返回值进行包装，确保返回的值是响应式的。
      next() {
        const { value, done } = innerIterator.next()
        return done
          ? { value, done }
          : {
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done
            }
      },
      // iterable protocol
      // [Symbol.iterator]() 方法返回当前对象自身，以支持方法链式调用。
      [Symbol.iterator]() {
        return this
      }
    }
  }
}

function createReadonlyMethod(type: TriggerOpTypes): Function {
  return function (this: CollectionTypes, ...args: unknown[]) {
    return type === TriggerOpTypes.DELETE
      ? false
      : type === TriggerOpTypes.CLEAR
        ? undefined
        : this
  }
}

function createInstrumentations() {
  const mutableInstrumentations: Record<string, Function | number> = {
    get(this: MapTypes, key: unknown) {
      return get(this, key)
    },
    get size() {
      return size(this as unknown as IterableCollections)
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, false)
  }
  const shallowInstrumentations: Record<string, Function | number> = {
    get(this: MapTypes, key: unknown) {
      return get(this, key, false, true)
    },
    get size() {
      return size(this as unknown as IterableCollections)
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, true)
  }
  const readonlyInstrumentations: Record<string, Function | number> = {
    get(this: MapTypes, key: unknown) {
      return get(this, key, true)
    },
    get size() {
      return size(this as unknown as IterableCollections, true)
    },
    has(this: MapTypes, key: unknown) {
      return has.call(this, key, true)
    },
    add: createReadonlyMethod(TriggerOpTypes.ADD),
    set: createReadonlyMethod(TriggerOpTypes.SET),
    delete: createReadonlyMethod(TriggerOpTypes.DELETE),
    clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
    forEach: createForEach(true, false)
  }
  const shallowReadonlyInstrumentations: Record<string, Function | number> = {
    get(this: MapTypes, key: unknown) {
      return get(this, key, true, true)
    },
    get size() {
      return size(this as unknown as IterableCollections, true)
    },
    has(this: MapTypes, key: unknown) {
      return has.call(this, key, true)
    },
    add: createReadonlyMethod(TriggerOpTypes.ADD),
    set: createReadonlyMethod(TriggerOpTypes.SET),
    delete: createReadonlyMethod(TriggerOpTypes.DELETE),
    clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
    forEach: createForEach(true, true)
  }

  const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
  iteratorMethods.forEach(method => {
    mutableInstrumentations[method as string] = createIterableMethod(
      method,
      false,
      false
    )
    readonlyInstrumentations[method as string] = createIterableMethod(
      method,
      true,
      false
    )
    shallowInstrumentations[method as string] = createIterableMethod(
      method,
      false,
      true
    )
    shallowReadonlyInstrumentations[method as string] = createIterableMethod(
      method,
      true,
      true
    )
  })

  return [
    mutableInstrumentations,
    readonlyInstrumentations,
    shallowInstrumentations,
    shallowReadonlyInstrumentations
  ]
}

const [
  mutableInstrumentations,
  readonlyInstrumentations,
  shallowInstrumentations,
  shallowReadonlyInstrumentations
] = createInstrumentations()

function createInstrumentationGetter(isReadonly: boolean, shallow: boolean) {
  const instrumentations = shallow
    ? isReadonly
      ? shallowReadonlyInstrumentations
      : shallowInstrumentations
    : isReadonly
      ? readonlyInstrumentations
      : mutableInstrumentations

  return (
    target: CollectionTypes,
    key: string | symbol,
    receiver: CollectionTypes
  ) => {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (key === ReactiveFlags.RAW) {
      return target
    }

    return Reflect.get(
      hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target,
      key,
      receiver
    )
  }
}

export const mutableCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(false, false)
}
export const shallowCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(false, true)
}
export const readonlyCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(true, false)
}
export const shallowReadonlyCollectionHandlers: ProxyHandler<CollectionTypes> =
  { get: createInstrumentationGetter(true, true) }
