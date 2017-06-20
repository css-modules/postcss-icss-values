# postcss-icss-values [![Build Status][travis-img]][travis]

[PostCSS]: https://github.com/postcss/postcss
[travis-img]: https://travis-ci.org/css-modules/postcss-icss-values.svg
[travis]: https://travis-ci.org/css-modules/postcss-icss-values

PostCSS plugin for css modules to pass arbitrary values between your module files.

## Usage

```js
postcss([ require('postcss-icss-values') ])
```

See [PostCSS] docs for examples for your environment.

### Export value

```css
/* colors.css */

@value primary: #BF4040;
/* or without colon for preprocessors */
@value secondary #1F4F7F;

.panel {
  background: primary;
}

/* transforms to */

:export {
  primary: #BF4040;
  secondary: #1F4F7F
}

.panel {
  background: #BF4040;
}
```

**If you are using Sass** along with this PostCSS plugin, do not use the colon `:` in your `@value` definitions. It will cause Sass to crash.

Note also you can _import_ multiple values at once but can only _define_ one value per line.

```css
@value a: b, c: d; /* defines a as "b, c: d" */
```

### Importing value

```css
@value primary, secondary from './colors.css';

.panel {
  background: secondary;
}

/* transforms to similar exports */

:import('./colors.css') {
  __value__primary__0: primary;
  __value__secondary__1: secondary
}
:export {
  primary: __value__primary__0; /* this long names will be mapped to imports by your loader */
  secondary: __value__secondary__1
}

.panel {
  background: __value__secondary__1;
}
```

### Importing value in JS

```css
import { primary } from './colors.css';
// will have similar effect
console.log(primary); // -> #BF4040
```

### Aliases

Do not conflict between names you are able to import values with aliases

```css
@value small as bp-small, large as bp-large from './breakpoints.css';
@value (
  small as t-small,
  large as t-large
) from './typo.css';

@media bp-small {
  .foo {
    font-size: t-small;
  }
}
```

### Messages

postcss-icss-values passes `result.messages` for each declared or imported value

```json
{
  plugin: 'postcss-icss-values',
  type: 'icss-value',
  name: string, // exported identifier
  value: string // generated imported identifier or value
}
```

## Justification

See [this PR](https://github.com/css-modules/css-modules-loader-core/pull/28) for more background

## License

MIT © Glen Maddern and Bogdan Chadkin, 2015
