/**
 * Make a map and return a function for checking if a key
 * is in that map.
 * IMPORTANT: all calls of this function must be prefixed with
 * \/\*#\_\_PURE\_\_\*\/
 * So that rollup can tree-shake them if necessary.
 * makeMap 是一个导出的函数，接受一个字符串 str 和一个可选的布尔参数 expectsLowerCase。
 * 返回的是一个函数，这个函数接受一个字符串 key 作为参数，返回一个布尔值，表示该字符串是否存在于之前传入的 str 中。
 */
export function makeMap(
  str: string,
  expectsLowerCase?: boolean
): (key: string) => boolean {
  // 创建一个空的映射对象，用于存储字符串列表中的键
  const map: Record<string, boolean> = Object.create(null)
  // 将输入的字符串按逗号分隔成一个字符串数组
  const list: Array<string> = str.split(',')
  // 遍历字符串数组，将每个元素作为映射对象的键，并将值设置为true
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }

  // 返回一个函数，该函数接受一个字符串作为参数，并返回该字符串是否存在于映射对象中
  return expectsLowerCase ? val => !!map[val.toLowerCase()] : val => !!map[val]
}
