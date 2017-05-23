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

export const extractICSS = css => {
  const imports = {}
  const exports = {}
  css.each(node => {
    if (node.type === 'rule') {
      const matches = importPattern.exec(node.selector)
      if (matches) {
        const path = matches[1]
        const aliases = Object.assign({}, imports[path], getDeclsObject(node))
        imports[path] = aliases
        node.remove()
      }
      if (exportPattern.test(node.selector)) {
        Object.assign(exports, getDeclsObject(node))
        node.remove()
      }
    }
  })
  return { imports, exports }
}

const createICSSImportsRules = imports => {
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

const createICSSExportsRule = exports => {
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

export const createICSSRules = (imports, exports) => [
  ...createICSSImportsRules(imports),
  createICSSExportsRule(exports)
]
