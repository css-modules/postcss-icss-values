const postcss = require('postcss')

const importPattern = /^:import\(("[^"]*"|'[^']*'|[\w-]+)\)$/

const exportPattern = /^:export$/

const getDeclsObject = rule => {
  const object = {}
  rule.walkDecls(decl => {
    object[decl.prop] = decl.value
  })
  return object
}

export const extractICSSImports = css => {
  const imports = {}
  css.walkRules(rule => {
    const matches = importPattern.exec(rule.selector)
    if (matches) {
      const path = matches[1]
      imports[path] = Object.assign({}, imports[path], getDeclsObject(rule))
      rule.remove()
    }
  })
  return imports
}

export const extractICSSExports = css => {
  const exports = {}
  css.walkRules(exportPattern, rule => {
    Object.assign(exports, getDeclsObject(rule))
    rule.remove()
  })
  return exports
}

const genICSSImportsRules = imports => {
  return Object.keys(imports).map(path => {
    const aliases = imports[path]
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
