const postcss = require('postcss')
const { default: replaceSymbols, replaceAll } = require('icss-replace-symbols')

const matchImports = /^(.+?|\([\s\S]+?\))\s+from\s+("[^"]*"|'[^']*'|[\w-]+)$/
const matchValueDefinition = /(?:\s+|^)([\w-]+):?\s+(.+?)\s*$/g
const matchImport = /^([\w-]+)(?:\s+as\s+([\w-]+))?/

const addImportsRules = (css, imports) => {
  const rules = imports.map(({ path, aliases }) => {
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
  css.prepend(rules)
}

const addExportsRule = (css, exports) => {
  const declarations = Object.keys(exports).map(key =>
    postcss.decl({
      prop: key,
      value: exports[key],
      raws: { before: '\n  ' }
    })
  )
  const rule = postcss
    .rule({
      selector: `:export`,
      raws: { after: '\n' }
    })
    .append(declarations)
  css.prepend(rule)
}

let importIndex = 0
const createImportedName = importName =>
  `i__const_${importName.replace(/\W/g, '_')}_${importIndex++}`

module.exports = postcss.plugin('postcss-modules-values', () => (
  css,
  result
) => {
  let importAliases = []
  let definitions = {}

  const addDefinition = atRule => {
    let matches
    while ((matches = matchValueDefinition.exec(atRule.params))) {
      let [, key, value] = matches
      // Add to the definitions, knowing that values can refer to each other
      definitions[key] = replaceAll(definitions, value)
      atRule.remove()
    }
  }

  const addImport = atRule => {
    let matches = matchImports.exec(atRule.params)
    if (matches) {
      let [, aliasesString, path] = matches
      // We can use constants for path names
      if (definitions[path]) path = definitions[path]
      let aliases = aliasesString
        .replace(/^\(\s*([\s\S]+)\s*\)$/, '$1')
        .split(/\s*,\s*/)
        .map(alias => {
          let tokens = matchImport.exec(alias)
          if (tokens) {
            let [, /*match*/ theirName, myName = theirName] = tokens
            let importedName = createImportedName(myName)
            definitions[myName] = importedName
            return { theirName, importedName }
          } else {
            throw new Error(`@import statement "${alias}" is invalid!`)
          }
        })
        .reduce((acc, { theirName, importedName }) => {
          acc[importedName] = theirName
          return acc
        }, {})
      importAliases.push({ path, aliases })
      atRule.remove()
    }
  }

  /* Look at all the @value statements and treat them as locals or as imports */
  css.walkAtRules('value', atRule => {
    if (matchImports.exec(atRule.params)) {
      addImport(atRule)
    } else {
      if (atRule.params.indexOf('@value') !== -1) {
        result.warn('Invalid value definition: ' + atRule.params)
      }

      addDefinition(atRule)
    }
  })

  /* If we have no definitions, don't continue */
  if (Object.keys(definitions).length === 0) return

  /* Perform replacements */
  replaceSymbols(css, definitions)

  addExportsRule(css, definitions)

  addImportsRules(css, importAliases)
})
