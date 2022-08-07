const msg: String = 'msg !!'

const obj: { msg: String; age?: Number } = {
    msg: '213',
}

const reactiveJ = (r) => {
    return new Proxy(r, {
        get(target, key) {
            console.log('取值了')
            return Reflect.get(target, key)
        },
        set(target, key, val) {
            console.log('设置了', target, key, val)
            return Reflect.set(target, key, val)
        },
    })
}

const copyObj = reactiveJ(obj)

console.log(copyObj.msg)
copyObj.msg = '——————你好 proxy'
