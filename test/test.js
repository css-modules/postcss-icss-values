/* eslint-env jest */
const postcss = require("postcss");
const stripIndent = require("strip-indent");
const plugin = require("../src");

const strip = input => stripIndent(input).trim();
const compile = input => postcss([plugin]).process(strip(input));
const runCSS = input => compile(input).then(result => result.css);
const runWarnings = input =>
  compile(input)
    .then(result => result.warnings())
    .then(warnings => warnings.map(warning => warning.text));

const run = ({ fixture, expected }) =>
  compile(fixture).then(result => {
    expect(result.css.trim()).toEqual(strip(expected));
  });

test("should export a constant", () => {
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
  );
});

test("gives an error when there is no semicolon between lines", () => {
  return expect(
    runWarnings(`
      @value red blue
      @value green yellow
    `)
  ).resolves.toEqual([
    "Invalid value definition: red blue\n@value green yellow"
  ]);
});

test("should export a more complex constant", () => {
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
  );
});

test("should replace constants within the file", () => {
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
  );
});

test("should import and re-export a simple constant", () => {
  return expect(
    runCSS(`
      @value red from "./colors.css";
    `)
  ).resolves.toEqual(
    strip(`
      :import('./colors.css') {
        __value__red__0: red
      }
      :export {
        red: __value__red__0
      }
    `)
  );
});

test("should import a simple constant and replace usages", () => {
  return expect(
    runCSS(`
      @value red from "./colors.css";
      .foo { color: red; }
    `)
  ).resolves.toEqual(
    strip(`
      :import('./colors.css') {
        __value__red__0: red;
      }
      :export {
        red: __value__red__0;
      }
      .foo { color: __value__red__0; }
    `)
  );
});

test("should import and alias a constant and replace usages", () => {
  return expect(
    runCSS(`
      @value blue as red from "./colors.css";
      .foo { color: red; }
    `)
  ).resolves.toEqual(
    strip(`
      :import('./colors.css') {
        __value__red__0: blue;
      }
      :export {
        red: __value__red__0;
      }
      .foo { color: __value__red__0; }
    `)
  );
});

test("should import multiple from a single file", () => {
  return expect(
    runCSS(`
      @value blue, red from "./colors.css";
      .foo { color: red; }
      .bar { color: blue }
    `)
  ).resolves.toEqual(
    strip(`
      :import('./colors.css') {
        __value__blue__0: blue;
        __value__red__1: red;
      }
      :export {
        blue: __value__blue__0;
        red: __value__red__1;
      }
      .foo { color: __value__red__1; }
      .bar { color: __value__blue__0 }
    `)
  );
});

test("not import from a definition", () => {
  return expect(
    runCSS(`
      @value colors: "./colors.css"; @value red from colors;
    `)
  ).resolves.toEqual(
    strip(`
      :import('colors') {
        __value__red__0: red
      }
      :export {
        colors: "./colors.css";
        red: __value__red__0
      }
    `)
  );
});

test("should allow transitive values", () => {
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
  );
});

test("should allow transitive values within calc", () => {
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
  );
});

test("should preserve import order", () => {
  return expect(
    runCSS(`
      @value a from "./a.css"; @value b from "./b.css";
    `)
  ).resolves.toEqual(
    strip(`
      :import('./a.css') {
        __value__a__0: a
      }
      :import('./b.css') {
        __value__b__1: b
      }
      :export {
        a: __value__a__0;
        b: __value__b__1
      }
    `)
  );
});

test("should allow custom-property-style names", () => {
  return expect(
    runCSS(`
      @value --red from "./colors.css"; .foo { color: --red; }
    `)
  ).resolves.toEqual(
    strip(`
      :import('./colors.css') {
        __value____red__0: --red;
      }
      :export {
        --red: __value____red__0;
      }
      .foo { color: __value____red__0; }
    `)
  );
});

test("should allow all colour types", () => {
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
  );
});

test("should import multiple from a single file on multiple lines", () => {
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
      :import('./colors.css') {
        __value__blue__0: blue;
        __value__red__1: red;
      }
      :export {
        blue: __value__blue__0;
        red: __value__red__1;
      }
      .foo { color: __value__red__1; }
      .bar { color: __value__blue__0 }
    `)
  );
});

test("should allow definitions with commas in them", () => {
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
  );
});

test("should allow values with nested parantheses", () => {
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
  );
});

test("reuse existing :import with same name and :export", () => {
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
        __value__a__0: a
      }
      :export {
        b: i__c;
        a: __value__a__0
      }
    `)
  );
});

test("save :import and :export statements", () => {
  const input = `
    :import('path') {
      __imported: value
    }
    :export {
      local: __imported
    }
  `;
  return run({
    fixture: input,
    expected: input
  });
});
