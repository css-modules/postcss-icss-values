/* global describe, it */

import postcss from 'postcss'
import assert from 'assert'

import constants from '../src'

const test = (input, expected) => {
  let processor = postcss([constants])
  assert.equal(processor.process(input).css, expected)
}

describe('constants', () => {
  it('should pass through an empty string', () => {
    test('', '')
  })

  it('should export a constant', () => {
    test('@define red blue;', ':export {\n  red: blue\n}')
  })

  it('should export a more complex constant', () => {
    test('@define small (max-width: 599px);', ':export {\n  small: (max-width: 599px)\n}')
  })

  it('should replace constants within the file', () => {
    test('@define blue red; .foo { color: blue; }', ':export {\n  blue: red;\n}\n.foo { color: red; }')
  })

  it('should import a simple constant', () => {
    test('@import red from "./colors.css";', ':import("./colors.css") {\n  i__const_red_0: red\n}')
  })

  it('should import a simple constant and replace usages', () => {
    test('@import red from "./colors.css"; .foo { color: red; }', ':import("./colors.css") {\n  i__const_red_1: red;\n}\n.foo { color: i__const_red_1; }')
  })

  it('should import and alias a constant and replace usages', () => {
    test('@import blue as red from "./colors.css"; .foo { color: red; }', ':import("./colors.css") {\n  i__const_red_2: blue;\n}\n.foo { color: i__const_red_2; }')
  })

  it('should import multiple from a single file', () => {
    test(
      `@import blue, red from "./colors.css";
.foo { color: red; }
.bar { color: blue }`,
      `:import("./colors.css") {
  i__const_blue_3: blue;
  i__const_red_4: red;
}
.foo { color: i__const_red_4; }
.bar { color: i__const_blue_3 }`)
  })

  it('should import from a definition', () => {
    test(
      '@define colors: "./colors.css"; @import red from colors;',
      ':export {\n  colors: "./colors.css"\n}\n' +
      ':import("./colors.css") {\n  i__const_red_5: red\n}'
    )
  })
})

