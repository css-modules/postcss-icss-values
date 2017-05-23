const postcss = require('postcss')

const genICSSImportsRules = imports => {
  return imports.map(({ path, aliases }) => {
    const declarations = Object.keys(aliases).map(key =>
      postcss.decl({
        prop: key,
        value: aliases[key],
        raws: { before: '\n  ' }
      })
    )
    return postcss
      .rule({
        selector: `:import(${path})`,
        raws: { after: '\n' }
      })
      .append(declarations)
  })
}

const genICSSExportsRule = exports => {
  const declarations = Object.keys(exports).map(key =>
    postcss.decl({
      prop: key,
      value: exports[key],
      raws: { before: '\n  ' }
    })
  )
  return postcss
    .rule({
      selector: `:export`,
      raws: { after: '\n' }
    })
    .append(declarations)
}

export const genICSSRules = (imports, exports) => [
  ...genICSSImportsRules(imports),
  genICSSExportsRule(exports)
]
