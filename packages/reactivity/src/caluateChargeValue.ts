export function calculateChargeValue(inputStr: any, exchangeRate: any) {
  // 使用正则表达式匹配数字和符号
  // let regex = null
  // if (inputStr.indexOf('$') !== -1 && inputStr.indexOf('¥') !== -1) {
  //   regex = /(-?\$?)([+\-]?\d+)([+\-]?¥?)(\d+)?/g
  // }
  const regex = /(-?\$?)([+\-]?\d+)([+\-]?\¥?)(\d+)(\.\d+)?/g
  const match: any = regex.exec(inputStr)
  let usResult = 0
  let cnResult = 0
  if (match.length === 0) {
    return inputStr
  }
  // console.log(match, 'match')
  const usPositive = match.findIndex((element: any) => element === '$')
  const usMinus = match.findIndex((element: any) => element === '-$')
  const cnPositive = match.findIndex(
    (element: any) => element === '¥' || element === '+¥'
  )
  const cnMinus = match.findIndex((element: any) => element === '-¥')
  if (usPositive !== -1 || usMinus !== -1) {
    usResult = usPositive !== -1 ? match[usPositive + 1] : -match[usMinus + 1]
  }
  // console.log(cnPositive, cnMinus)
  if (cnPositive !== -1 || cnMinus !== -1) {
    cnResult =
      cnPositive !== -1
        ? match[cnPositive + 1] / exchangeRate
        : -match[cnMinus + 1] / exchangeRate
  }
  if (
    inputStr.indexOf('$') === -1 &&
    inputStr.indexOf('-$') === -1 &&
    inputStr
  ) {
    if (inputStr.indexOf('¥') !== -1 && inputStr.indexOf('-') === -1) {
      const r = match[0] / exchangeRate
      return parseFloat(r.toFixed(1))
    }
    if (inputStr.indexOf('-¥') !== -1) {
      const r = -match[0] / exchangeRate
      return parseFloat(r.toFixed(1))
    }
  }
  const r = usResult * 1 + cnResult * 1
  console.log(r, 'asdass')
  return parseFloat(r.toFixed(1))
}

// chargeValue20gp : "$7+¥7"
// chargeValue40gp : "-$93+¥7"
// chargeValue40hq : "$7-¥193"
// chargeValue45hq : "$11+¥7"
// console.log(calculateChargeValue('-$93+¥10', 10)) // 输出: -92
// console.log(calculateChargeValue('$7+¥7', 10)) // 输出: 7.1
// console.log(calculateChargeValue('$7-¥7', 10)) // 输出:6.3
// console.log(calculateChargeValue('$140¥2000', 10)) // 输出: 340
// console.log(calculateChargeValue('-$140¥2000', 10)) // 输出: 60
// console.log(calculateChargeValue('$140-¥2000', 10)) // 输出: -60
// console.log(calculateChargeValue('$140', 10)) // 输出: 140
// console.log(calculateChargeValue('-$140', 10)) // 输出: 14
// console.log(calculateChargeValue('-¥140', 10)) // 输出: -14
// console.log(calculateChargeValue('¥140', 10)) // 输出: 14
// console.log(calculateChargeValue('-$140¥0', 10)) // 输出: -140
