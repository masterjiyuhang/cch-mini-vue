# setup
yarn add typescript -D

npx tsc --init

yarn add jest @types/jest --dev

yarn add --dev babel-jest @babel/core @babel/preset-env
babel.config.js

```js
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
}
```

yarn add --dev @babel/preset-typescript
