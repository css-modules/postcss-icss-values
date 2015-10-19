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
    test('@value red blue;', ':export {\n  red: blue\n}')
  })

  it('should export a more complex constant', () => {
    test('@value small (max-width: 599px);', ':export {\n  small: (max-width: 599px)\n}')
  })

  it('should replace constants within the file', () => {
    test('@value blue red; .foo { color: blue; }', ':export {\n  blue: red;\n}\n.foo { color: red; }')
  })

  it('should import and re-export a simple constant', () => {
    test('@value red from "./colors.css";', ':export {\n  red: i__const_red_0\n}\n:import("./colors.css") {\n  i__const_red_0: red\n}')
  })

  it('should import a simple constant and replace usages', () => {
    test('@value red from "./colors.css"; .foo { color: red; }', ':export {\n  red: i__const_red_1;\n}\n:import("./colors.css") {\n  i__const_red_1: red;\n}\n.foo { color: i__const_red_1; }')
  })

  it('should import and alias a constant and replace usages', () => {
    test('@value blue as red from "./colors.css"; .foo { color: red; }', ':export {\n  red: i__const_red_2;\n}\n:import("./colors.css") {\n  i__const_red_2: blue;\n}\n.foo { color: i__const_red_2; }')
  })

  it('should import multiple from a single file', () => {
    test(
      `@value blue, red from "./colors.css";
.foo { color: red; }
.bar { color: blue }`,
      `:export {
  blue: i__const_blue_3;
  red: i__const_red_4;
}
:import("./colors.css") {
  i__const_blue_3: blue;
  i__const_red_4: red;
}
.foo { color: i__const_red_4; }
.bar { color: i__const_blue_3 }`)
  })

  it('should import from a definition', () => {
    test(
      '@value colors: "./colors.css"; @value red from colors;',
      ':export {\n  colors: "./colors.css";\n  red: i__const_red_5\n}\n' +
      ':import("./colors.css") {\n  i__const_red_5: red\n}'
    )
  })

  it('should only allow values for paths if defined in the right order', () => {
    test(
      '@value red from colors; @value colors: "./colors.css";',
      ':export {\n  red: i__const_red_6;\n  colors: "./colors.css"\n}\n' +
      ':import(colors) {\n  i__const_red_6: red\n}'
    )
  })

  it('should allow transitive values', () => {
    test(
      '@value aaa: red;\n@value bbb: aaa;\n.a { color: bbb; }',
      ':export {\n  aaa: red;\n  bbb: red;\n}\n.a { color: red; }'
    )
  })
})

