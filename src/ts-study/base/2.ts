/**
 * any
 * 任意类型
 *
 * 1. 普通类型在赋值过程中是不允许改变类型的，any类型允许被赋值成任意类型
 * 2. 在任意值上访问任何属性都是允许的。 声明为一个任意类型之后，对它的任何操作都是允许的，返回的内容类型都是任意值。
 */

type cch_obj = {
  name: string
  age: number
}

let test_obj_cch: cch_obj = {}

test_obj_cch.number

// 变量如果在声明的时候，未指定其类型，那么它会被标识为任意类型
let anything_cch
anything_cch = 'string'
anything_cch = 123

/**
 * 类型推论
 *
 * 如果没有明确的指定类型，那么ts会依照类型推论的规则推断出一个类型。
 * 如果定义的时候没有赋值，不管之后有没有赋值，都会被推断成 any 类型而完全不被类型检查。
 */

let type_inference_cch = 'sir'
type_inference_cch = 12

/**
 * 联合类型
 *
 * 表示取值可以为多种类型的一种
 * 联合类型使用 | 分隔每个类型
 */

let union_types_cch: string | number
union_types_cch = 2
union_types_cch = 'sd'

// 访问联合类型的属性或者方法
// 当ts不能确定一个联合类型的变量到底是哪个类型的时候，只能访问此联合类型的所有类型里面共有的属性或者方法。

function getLength_cch(something: string | number) {
  // 访问string和number的共有属性是没问题的
  something.toLocaleString()

  //   联合类型的变量在赋值的时候，会根据类型推论的规则推断出一个类型
  let test_union_number: string | number
  test_union_number = 'six'
  test_union_number.length
  test_union_number = 6
  test_union_number.length // 推断成了number类型，访问它的length属性就会报错

  // length 不是 string 和 number的共有属性，所以会报错
  return something.length
}
