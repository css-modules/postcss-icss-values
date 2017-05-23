const postcss = require('postcss')
const { default: replaceSymbols, replaceAll } = require('icss-replace-symbols')
const { extractICSS, createICSSRules } = require('./icss.js')

const matchImports = /^(.+?|\([\s\S]+?\))\s+from\s+("[^"]*"|'[^']*'|[\w-]+)$/
const matchValueDefinition = /(?:\s+|^)([\w-]+):?\s+(.+?)\s*$/g
const matchImport = /^([\w-]+)(?:\s+as\s+([\w-]+))?/

// 'i' prefix to prevent postcss parsing "_" as css hook
const getAliasName = (name, index) =>
  `i__value_${name.replace(/\W/g, '_')}_${index}`

module.exports = postcss.plugin('postcss-modules-values', () => (
  css,
  result
) => {
  const { imports, exports } = extractICSS(css)
  let importIndex = 0
  const createImportedName = (path, name) => {
    const importedName = getAliasName(name, importIndex)
    if (imports[path] && imports[path][importedName]) {
      importIndex += 1
      return createImportedName(path, name)
    }
    importIndex += 1
    return importedName
  }

  const addDefinition = atRule => {
    let matches
    while ((matches = matchValueDefinition.exec(atRule.params))) {
      let [, key, value] = matches
      // Add to the definitions, knowing that values can refer to each other
      exports[key] = replaceAll(exports, value)
      atRule.remove()
    }
  }

  const addImport = atRule => {
    let matches = matchImports.exec(atRule.params)
    if (matches) {
      let [, aliasesString, path] = matches
      // We can use constants for path names
      if (exports[path]) path = exports[path]
      let aliases = aliasesString
        .replace(/^\(\s*([\s\S]+)\s*\)$/, '$1')
        .split(/\s*,\s*/)
        .map(alias => {
          let tokens = matchImport.exec(alias)
          if (tokens) {
            let [, theirName, myName = theirName] = tokens
            let importedName = createImportedName(path, myName)
            exports[myName] = importedName
            return { theirName, importedName }
          } else {
            throw new Error(`@import statement "${alias}" is invalid!`)
          }
        })
        .reduce((acc, { theirName, importedName }) => {
          acc[importedName] = theirName
          return acc
        }, {})
      imports[path] = Object.assign({}, imports[path], aliases)
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
  if (Object.keys(exports).length === 0) return

  /* Perform replacements */
  replaceSymbols(css, exports)

  css.prepend(createICSSRules(imports, exports))
})
