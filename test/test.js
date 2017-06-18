/* eslint-env jest */
const postcss = require("postcss");
const stripIndent = require("strip-indent");
const plugin = require("../src");

const strip = input => stripIndent(input).trim();

const compile = input => postcss([plugin]).process(strip(input));

const getWarnings = result => result.warnings().map(warning => warning.text);

const run = ({ fixture, expected, warnings = [] }) =>
  compile(fixture).then(result => {
    expect(getWarnings(result)).toEqual(warnings);
    if (expected) {
      expect(result.css.trim()).toEqual(strip(expected));
    }
  });

test("export a constant", () => {
  return run({
    fixture: `
      @value red blue;@value red blue;
    `,
    expected: `
      :export {
        red: blue
      }
    `
  });
});

test("warn when there is no semicolon between lines", () => {
  return run({
    fixture: `
      @value red blue
      @value green yellow
    `,
    warnings: ["Invalid value definition: red blue\n@value green yellow"]
  });
});

test("export a more complex constant", () => {
  return run({
    fixture: `
      @value small (max-width: 599px);
    `,
    expected: `
      :export {
        small: (max-width: 599px)
      }
    `
  });
});

test("replace constants within the file", () => {
  return run({
    fixture: `
      @value blue red; .foo { color: blue; }
    `,
    expected: `
      :export {
        blue: red;
      }
      .foo { color: red; }
    `
  });
});

test("import and re-export a simple constant", () => {
  return run({
    fixture: `
      @value red from "./colors.css";
    `,
    expected: `
      :import('./colors.css') {
        __value__red__0: red
      }
      :export {
        red: __value__red__0
      }
    `
  });
});

test("import a simple constant and replace usages", () => {
  return run({
    fixture: `
      @value red from "./colors.css";
      .foo { color: red; }
    `,
    expected: `
      :import('./colors.css') {
        __value__red__0: red;
      }
      :export {
        red: __value__red__0;
      }
      .foo { color: __value__red__0; }
    `
  });
});

test("import and alias a constant and replace usages", () => {
  return run({
    fixture: `
      @value blue as red from "./colors.css";
      .foo { color: red; }
    `,
    expected: `
      :import('./colors.css') {
        __value__red__0: blue;
      }
      :export {
        red: __value__red__0;
      }
      .foo { color: __value__red__0; }
    `
  });
});

test("import multiple from a single file", () => {
  return run({
    fixture: `
      @value blue, red from "./colors.css";
      .foo { color: red; }
      .bar { color: blue }
    `,
    expected: `
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
    `
  });
});

test("not import from a definition", () => {
  return run({
    fixture: `
      @value colors: "./colors.css"; @value red from colors;
    `,
    expected: `
      :import('colors') {
        __value__red__0: red
      }
      :export {
        colors: "./colors.css";
        red: __value__red__0
      }
    `
  });
});

test("allow transitive values", () => {
  return run({
    fixture: `
      @value aaa: red;
      @value bbb: aaa;
      .a { color: bbb; }
    `,
    expected: `
      :export {
        aaa: red;
        bbb: red;
      }
      .a { color: red; }
    `
  });
});

test("allow transitive values within calc", () => {
  return run({
    fixture: `
      @value base: 10px;
      @value large: calc(base * 2);
      .a { margin: large; }
    `,
    expected: `
      :export {
        base: 10px;
        large: calc(10px * 2);
      }
      .a { margin: calc(10px * 2); }
    `
  });
});

test("preserve import order", () => {
  return run({
    fixture: `
      @value a from "./a.css"; @value b from "./b.css";
    `,
    expected: `
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
    `
  });
});

test("allow custom-property-style names", () => {
  return run({
    fixture: `
      @value --red from "./colors.css"; .foo { color: --red; }
    `,
    expected: `
      :import('./colors.css') {
        __value____red__0: --red;
      }
      :export {
        --red: __value____red__0;
      }
      .foo { color: __value____red__0; }
    `
  });
});

test("allow all colour types", () => {
  return run({
    fixture: `
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
    `,
    expected: `
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
    `
  });
});

test("import multiple from a single file on multiple lines", () => {
  return run({
    fixture: `
      @value (
        blue,
        red
      ) from "./colors.css";
      .foo { color: red; }
      .bar { color: blue }
    `,
    expected: `
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
    `
  });
});

test("allow definitions with commas in them", () => {
  return run({
    fixture: `
      @value coolShadow: 0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14)   ;
      .foo { box-shadow: coolShadow; }
    `,
    expected: `
      :export {
        coolShadow: 0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14);
      }
      .foo { box-shadow: 0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14); }
    `
  });
});

test("allow values with nested parantheses", () => {
  return run({
    fixture: `
      @value aaa: color(red lightness(50%));
    `,
    expected: `
      :export {
        aaa: color(red lightness(50%))
      }
    `
  });
});

test("reuse existing :import with same name and :export", () => {
  return run({
    fixture: `
      :import('./colors.css') {
        i__some_import: blue;
      }
      :export {
        b: i__c;
      }
      @value a from './colors.css';
    `,
    expected: `
      :import('./colors.css') {
        i__some_import: blue;
        __value__a__0: a
      }
      :export {
        b: i__c;
        a: __value__a__0
      }
    `
  });
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
