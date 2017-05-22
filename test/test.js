const postcss = require('postcss')
const plugin = require('../src')

const run = (input) => postcss([plugin]).process(input)
const runCSS = (input) => run(input).then((result) => result.css)
const join = (...args) => args.join('\n')

test('should pass through an empty string', () =>
  expect(runCSS('')).resolves.toEqual('')
)

test('should export a constant', () =>
  expect(runCSS('@value red blue;@value red blue;')).resolves.toEqual(':export {\n  red: blue\n}')
)

test('gives an error when there is no semicolon between lines', () =>
  run('@value red blue\n@value green yellow').then((result) => {
    const warnings = result.warnings()

    expect(warnings.length).toEqual(1)
    expect(warnings[0].text).toEqual('Invalid value definition: red blue\n@value green yellow')
  })
)

test('should export a more complex constant', () =>
  expect(runCSS('@value small (max-width: 599px);')).resolves.toEqual(':export {\n  small: (max-width: 599px)\n}')
)

test('should replace constants within the file', () =>
  expect(runCSS(
    '@value blue red; .foo { color: blue; }'
  )).resolves.toEqual(
    ':export {\n  blue: red;\n}\n.foo { color: red; }'
  )
)

test('should import and re-export a simple constant', () =>
  expect(runCSS(
    '@value red from "./colors.css";'
  )).resolves.toEqual(
    ':import("./colors.css") {\n  i__const_red_0: red\n}\n:export {\n  red: i__const_red_0\n}'
  )
)

test('should import a simple constant and replace usages', () =>
  expect(runCSS(
    '@value red from "./colors.css"; .foo { color: red; }'
  )).resolves.toEqual(join(
    ':import("./colors.css") {\n  i__const_red_1: red;\n}',
    ':export {\n  red: i__const_red_1;\n}',
    '.foo { color: i__const_red_1; }'
  ))
)

test('should import and alias a constant and replace usages', () =>
  expect(runCSS(
    '@value blue as red from "./colors.css"; .foo { color: red; }'
  )).resolves.toEqual(join(
    ':import("./colors.css") {\n  i__const_red_2: blue;\n}',
    ':export {\n  red: i__const_red_2;\n}',
    '.foo { color: i__const_red_2; }'
  ))
)

test('should import multiple from a single file', () =>
  expect(runCSS(join(
    '@value blue, red from "./colors.css";',
    '.foo { color: red; }',
    '.bar { color: blue }'
  ))).resolves.toEqual(join(
    ':import("./colors.css") {\n  i__const_blue_3: blue;\n  i__const_red_4: red;\n}',
    ':export {\n  blue: i__const_blue_3;\n  red: i__const_red_4;\n}',
    '.foo { color: i__const_red_4; }',
    '.bar { color: i__const_blue_3 }'
  ))
)

test('should import from a definition', () =>
  expect(runCSS(
    '@value colors: "./colors.css"; @value red from colors;'
  )).resolves.toEqual(join(
    ':import("./colors.css") {\n  i__const_red_5: red\n}',
    ':export {\n  colors: "./colors.css";\n  red: i__const_red_5\n}'
  ))
)

test('should only allow values for paths if defined in the right order', () =>
  expect(runCSS(
    '@value red from colors; @value colors: "./colors.css";'
  )).resolves.toEqual(join(
    ':import(colors) {\n  i__const_red_6: red\n}',
    ':export {\n  red: i__const_red_6;\n  colors: "./colors.css"\n}'
  ))
)

test('should allow transitive values', () =>
  expect(runCSS(
    '@value aaa: red;\n@value bbb: aaa;\n.a { color: bbb; }'
  )).resolves.toEqual(
    ':export {\n  aaa: red;\n  bbb: red;\n}\n.a { color: red; }'
  )
)

test('should allow transitive values within calc', () =>
  expect(runCSS(
    '@value base: 10px;\n@value large: calc(base * 2);\n.a { margin: large; }'
  )).resolves.toEqual(
    ':export {\n  base: 10px;\n  large: calc(10px * 2);\n}\n.a { margin: calc(10px * 2); }'
  )
)

test('should preserve import order', () =>
  expect(runCSS(
    '@value a from "./a.css"; @value b from "./b.css";'
  )).resolves.toEqual(join(
    ':import("./a.css") {\n  i__const_a_7: a\n}',
    ':import("./b.css") {\n  i__const_b_8: b\n}',
    ':export {\n  a: i__const_a_7;\n  b: i__const_b_8\n}'
  ))
)

test('should allow custom-property-style names', () =>
  expect(runCSS(
    '@value --red from "./colors.css"; .foo { color: --red; }'
  )).resolves.toEqual(join(
    ':import("./colors.css") {\n  i__const___red_9: --red;\n}',
    ':export {\n  --red: i__const___red_9;\n}',
    '.foo { color: i__const___red_9; }'
  ))
)

test('should allow all colour types', () =>
  expect(runCSS(join(
    '@value named: red; @value 3char #0f0; @value 6char #00ff00; @value rgba rgba(34, 12, 64, 0.3); @value hsla hsla(220, 13.0%, 18.0%, 1);',
    '.foo { color: named; background-color: 3char; border-top-color: 6char; border-bottom-color: rgba; outline-color: hsla; }'
  ))).resolves.toEqual(join(
    ':export {\n  named: red;\n  3char: #0f0;\n  6char: #00ff00;\n  rgba: rgba(34, 12, 64, 0.3);\n  hsla: hsla(220, 13.0%, 18.0%, 1);\n}',
    '.foo { color: red; background-color: #0f0; border-top-color: #00ff00; border-bottom-color: rgba(34, 12, 64, 0.3); outline-color: hsla(220, 13.0%, 18.0%, 1); }'
  ))
)

test('should import multiple from a single file on multiple lines', () =>
  expect(runCSS(join(
    '@value (\n  blue,\n  red\n) from "./colors.css";',
    '.foo { color: red; }',
    '.bar { color: blue }'
  ))).resolves.toEqual(join(
    ':import("./colors.css") {\n  i__const_blue_10: blue;\n  i__const_red_11: red;\n}',
    ':export {\n  blue: i__const_blue_10;\n  red: i__const_red_11;\n}',
    '.foo { color: i__const_red_11; }',
    '.bar { color: i__const_blue_10 }'
  ))
)

test('should allow definitions with commas in them', () =>
  expect(runCSS(join(
    '@value coolShadow: 0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14)   ;',
    '.foo { box-shadow: coolShadow; }'
  ))).resolves.toEqual(join(
    ':export {\n  coolShadow: 0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14);\n}',
    '.foo { box-shadow: 0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14); }'
  ))
)

test('should allow values with nested parantheses', () =>
  expect(runCSS(
    '@value aaa: color(red lightness(50%));'
  )).resolves.toEqual(
    ':export {\n  aaa: color(red lightness(50%))\n}'
  )
)
