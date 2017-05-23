const postcss = require('postcss')
const stripIndent = require('strip-indent')
const plugin = require('../src')

const strip = input => stripIndent(input).replace(/^\n/, '')
const run = input => postcss([plugin]).process(strip(input))
const runCSS = input => run(input).then(result => result.css)
const runWarnings = input =>
  run(input)
    .then(result => result.warnings())
    .then(warnings => warnings.map(warning => warning.text))

test('should pass through an empty string', () => {
  return expect(runCSS('')).resolves.toEqual('')
})

test('should export a constant', () => {
  return expect(
    runCSS(`
      @value red blue;@value red blue;
    `)
  ).resolves.toEqual(
    strip(`
      :export {
        red: blue
      }
    `)
  )
})

test('gives an error when there is no semicolon between lines', () => {
  return expect(
    runWarnings(`
      @value red blue
      @value green yellow
    `)
  ).resolves.toEqual([
    'Invalid value definition: red blue\n@value green yellow'
  ])
})

test('should export a more complex constant', () => {
  return expect(
    runCSS(`
      @value small (max-width: 599px);
    `)
  ).resolves.toEqual(
    strip(`
      :export {
        small: (max-width: 599px)
      }
    `)
  )
})

test('should replace constants within the file', () => {
  return expect(
    runCSS(`
      @value blue red; .foo { color: blue; }
    `)
  ).resolves.toEqual(
    strip(`
      :export {
        blue: red;
      }
      .foo { color: red; }
    `)
  )
})

test('should import and re-export a simple constant', () => {
  return expect(
    runCSS(`
      @value red from "./colors.css";
    `)
  ).resolves.toEqual(
    strip(`
      :import("./colors.css") {
        i__value_red_0: red
      }
      :export {
        red: i__value_red_0
      }
    `)
  )
})

test('should import a simple constant and replace usages', () => {
  return expect(
    runCSS(`
      @value red from "./colors.css";
      .foo { color: red; }
    `)
  ).resolves.toEqual(
    strip(`
      :import("./colors.css") {
        i__value_red_1: red;
      }
      :export {
        red: i__value_red_1;
      }
      .foo { color: i__value_red_1; }
    `)
  )
})

test('should import and alias a constant and replace usages', () => {
  return expect(
    runCSS(`
      @value blue as red from "./colors.css";
      .foo { color: red; }
    `)
  ).resolves.toEqual(
    strip(`
      :import("./colors.css") {
        i__value_red_2: blue;
      }
      :export {
        red: i__value_red_2;
      }
      .foo { color: i__value_red_2; }
    `)
  )
})

test('should import multiple from a single file', () => {
  return expect(
    runCSS(`
      @value blue, red from "./colors.css";
      .foo { color: red; }
      .bar { color: blue }
    `)
  ).resolves.toEqual(
    strip(`
      :import("./colors.css") {
        i__value_blue_3: blue;
        i__value_red_4: red;
      }
      :export {
        blue: i__value_blue_3;
        red: i__value_red_4;
      }
      .foo { color: i__value_red_4; }
      .bar { color: i__value_blue_3 }
    `)
  )
})

test('should import from a definition', () => {
  return expect(
    runCSS(`
      @value colors: "./colors.css"; @value red from colors;
    `)
  ).resolves.toEqual(
    strip(`
      :import("./colors.css") {
        i__value_red_5: red
      }
      :export {
        colors: "./colors.css";
        red: i__value_red_5
      }
    `)
  )
})

test('should only allow values for paths if defined in the right order', () => {
  return expect(
    runCSS(`
      @value red from colors; @value colors: "./colors.css";
    `)
  ).resolves.toEqual(
    strip(`
      :import(colors) {
        i__value_red_6: red
      }
      :export {
        red: i__value_red_6;
        colors: "./colors.css"
      }
    `)
  )
})

test('should allow transitive values', () => {
  return expect(
    runCSS(`
      @value aaa: red;
      @value bbb: aaa;
      .a { color: bbb; }
    `)
  ).resolves.toEqual(
    strip(`
      :export {
        aaa: red;
        bbb: red;
      }
      .a { color: red; }
    `)
  )
})

test('should allow transitive values within calc', () => {
  return expect(
    runCSS(`
      @value base: 10px;
      @value large: calc(base * 2);
      .a { margin: large; }
    `)
  ).resolves.toEqual(
    strip(`
      :export {
        base: 10px;
        large: calc(10px * 2);
      }
      .a { margin: calc(10px * 2); }
    `)
  )
})

test('should preserve import order', () => {
  return expect(
    runCSS(`
      @value a from "./a.css"; @value b from "./b.css";
    `)
  ).resolves.toEqual(
    strip(`
      :import("./a.css") {
        i__value_a_7: a
      }
      :import("./b.css") {
        i__value_b_8: b
      }
      :export {
        a: i__value_a_7;
        b: i__value_b_8
      }
    `)
  )
})

test('should allow custom-property-style names', () => {
  return expect(
    runCSS(`
      @value --red from "./colors.css"; .foo { color: --red; }
    `)
  ).resolves.toEqual(
    strip(`
      :import("./colors.css") {
        i__value___red_9: --red;
      }
      :export {
        --red: i__value___red_9;
      }
      .foo { color: i__value___red_9; }
    `)
  )
})

test('should allow all colour types', () => {
  return expect(
    runCSS(`
      @value named: red;
      @value 3char #0f0;
      @value 6char #00ff00;
      @value rgba rgba(34, 12, 64, 0.3);
      @value hsla hsla(220, 13.0%, 18.0%, 1);
      .foo {
        color: named;
        background-color: 3char;
        border-top-color: 6char;
        border-bottom-color: rgba;
        outline-color: hsla;
      }
    `)
  ).resolves.toEqual(
    strip(`
      :export {
        named: red;
        3char: #0f0;
        6char: #00ff00;
        rgba: rgba(34, 12, 64, 0.3);
        hsla: hsla(220, 13.0%, 18.0%, 1);
      }
      .foo {
        color: red;
        background-color: #0f0;
        border-top-color: #00ff00;
        border-bottom-color: rgba(34, 12, 64, 0.3);
        outline-color: hsla(220, 13.0%, 18.0%, 1);
      }
    `)
  )
})

test('should import multiple from a single file on multiple lines', () => {
  return expect(
    runCSS(`
      @value (
        blue,
        red
      ) from "./colors.css";
      .foo { color: red; }
      .bar { color: blue }
    `)
  ).resolves.toEqual(
    strip(`
      :import("./colors.css") {
        i__value_blue_10: blue;
        i__value_red_11: red;
      }
      :export {
        blue: i__value_blue_10;
        red: i__value_red_11;
      }
      .foo { color: i__value_red_11; }
      .bar { color: i__value_blue_10 }
    `)
  )
})

test('should allow definitions with commas in them', () => {
  return expect(
    runCSS(`
      @value coolShadow: 0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14)   ;
      .foo { box-shadow: coolShadow; }
    `)
  ).resolves.toEqual(
    strip(`
      :export {
        coolShadow: 0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14);
      }
      .foo { box-shadow: 0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14); }
    `)
  )
})

test('should allow values with nested parantheses', () => {
  return expect(
    runCSS(`
      @value aaa: color(red lightness(50%));
    `)
  ).resolves.toEqual(
    strip(`
      :export {
        aaa: color(red lightness(50%))
      }
    `)
  )
})

test('reuse existing :import with same name and :export', () => {
  return expect(
    runCSS(`
      :import('./colors.css') {
        i__some_import: blue;
      }
      :export {
        b: i__c;
      }
      @value a from './colors.css';
    `)
  ).resolves.toEqual(
    strip(`
      :import('./colors.css') {
        i__some_import: blue;
        i__value_a_12: a
      }
      :export {
        b: i__c;
        a: i__value_a_12
      }
    `)
  )
})

test('prevent imported names collision', () => {
  return expect(
    runCSS(`
      :import(colors) {
        i__value_a_13: a;
      }
      @value a from colors;
    `)
  ).resolves.toEqual(
    strip(`
      :import(colors) {
        i__value_a_13: a;
        i__value_a_14: a
      }
      :export {
        a: i__value_a_14
      }
    `)
  )
})
