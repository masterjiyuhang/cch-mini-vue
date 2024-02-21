import { calculateChargeValue } from '../src/caluateChargeValue'

describe('caluateChargeValue', () => {
  // it('-$93+¥10', () => {
  //   const res = calculateChargeValue('-$93+¥10', 10)
  //   expect(res).toEqual(-92)
  // })
  // it('$7+¥7', () => {
  //   const res = calculateChargeValue('$7+¥7', 10)
  //   expect(res).toEqual(7.7)
  // })
  // it('$7-¥7', () => {
  //   const res = calculateChargeValue('$7-¥7', 10)

  //   expect(res).toEqual(6.3)
  // })
  // it('$140¥2000', () => {
  //   const res = calculateChargeValue('$140¥2000', 10)

  //   expect(res).toEqual(340)
  // })
  // it('-$140¥2000', () => {
  //   const res = calculateChargeValue('-$140¥2000', 10)

  //   expect(res).toEqual(60)
  // })
  it('$140-¥2000', () => {
    const res = calculateChargeValue('$140-¥2000', 10)

    expect(res).toEqual(-60)
  })
  // it('$155', () => {
  //   const res = calculateChargeValue('$155', 10)

  //   expect(res).toEqual(155)
  // })
  // it('-$155', () => {
  //   const res = calculateChargeValue('-$155', 10)

  //   expect(res).toEqual(-155)
  // })
  // it('+$155', () => {
  //   const res = calculateChargeValue('+$155', 10)
  //   expect(res).toEqual(155)
  // })
  // it('+¥188', () => {
  //   const res = calculateChargeValue('+¥188', 10)

  //   expect(res).toEqual(18.8)
  // })
  it('¥188.8', () => {
    const res = calculateChargeValue('¥188.8', 10)

    expect(res).toEqual(18.9)
  })
  // it('-¥188', () => {
  //   const res = calculateChargeValue('-¥188', 10)
  //   expect(res).toEqual(-18.8)
  // })
})
