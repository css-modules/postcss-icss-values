/* eslint-env jest */
import postcss from "postcss";
import stripIndent from "strip-indent";
import plugin from "../src";

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

test("export value", () => {
  return run({
    fixture: `
      @value red 1px solid #f00;
      @value blue: 1px solid #00f;
    `,
    expected: `
      :export {
        red: 1px solid #f00;
        blue: 1px solid #00f
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
    warnings: [`Invalid value definition "red blue\n@value green yellow"`]
  });
});

test("replace values within the file", () => {
  return run({
    fixture: `
      @value blue red;
      @media blue {
        .blue { color: blue }
      }
    `,
    expected: `
      :export {
        blue: red
      }
      @media red {
        .red { color: red }
      }
    `
  });
});

test("import external values", () => {
  return run({
    fixture: `
      @value red from "./colors.css";
      .foo { color: red }
    `,
    expected: `
      :import('./colors.css') {
        __value__red__0: red
      }
      :export {
        red: __value__red__0
      }
      .foo { color: __value__red__0 }
    `
  });
});

test("import multiple external values", () => {
  return run({
    fixture: `
      @value red, blue from 'path1';
      @value green, yellow from 'path2';
    `,
    expected: `
      :import('path1') {
        __value__red__0: red;
        __value__blue__1: blue
      }
      :import('path2') {
        __value__green__2: green;
        __value__yellow__3: yellow
      }
      :export {
        red: __value__red__0;
        blue: __value__blue__1;
        green: __value__green__2;
        yellow: __value__yellow__3
      }
    `
  });
});

test("import external values with aliases", () => {
  return run({
    fixture: `
      @value red as red1, blue as blue1 from 'path';
      .foo { color: red1; background: blue }
    `,
    expected: `
      :import('path') {
        __value__red1__0: red;
        __value__blue1__1: blue
      }
      :export {
        red1: __value__red1__0;
        blue1: __value__blue1__1
      }
      .foo { color: __value__red1__0; background: blue }
    `
  });
});

test("warn on unexpected value defintion or import", () => {
  return run({
    fixture: `
      @value red;
      @value red: ;
      @value red from;
      @value red blue from 'path';
      @value red from global;
      @value red from 'path' token;
      @value red as 'blue' from 'path';
      @value 'red' as blue from 'path';
      @value red 'as' blue from 'path';
    `,
    warnings: [
      `Invalid value definition "red"`,
      `Invalid value definition "red:"`,
      `Invalid value definition "red from"`,
      `Invalid value definition "red blue from 'path'"`,
      `Invalid value definition "red from global"`,
      `Invalid value definition "red from 'path' token"`,
      `Invalid value definition "red as 'blue' from 'path'"`,
      `Invalid value definition "'red' as blue from 'path'"`,
      `Invalid value definition "red 'as' blue from 'path'"`
    ]
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

test("import multiple values grouped with parentheses on multiple lines", () => {
  return run({
    fixture: `
      @value (
        blue,
        red
      ) from "path";
      .foo { color: red; }
      .bar { color: blue }
    `,
    expected: `
      :import('path') {
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

test("warn if value already declared and override result", () => {
  return run({
    fixture: `
      @value red: blue;
      @value red: green;
      @value red from 'path';
      .foo { color: red }
    `,
    expected: `
      :import('path') {
        __value__red__0: red
      }
      :export {
        red: __value__red__0
      }
      .foo { color: __value__red__0 }
    `,
    warnings: [`"red" value already declared`, `"red" value already declared`]
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
