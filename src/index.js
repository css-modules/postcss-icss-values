import postcss from 'postcss'
import {
  replaceSymbols,
  replaceValueSymbols,
  extractICSS,
  createICSSRules
} from 'icss-utils'

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
  const { icssImports, icssExports } = extractICSS(css)
  let importIndex = 0
  const createImportedName = (path, name) => {
    const importedName = getAliasName(name, importIndex)
    if (icssImports[path] && icssImports[path][importedName]) {
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
      icssExports[key] = replaceValueSymbols(value, icssExports)
      atRule.remove()
    }
  }

  const addImport = atRule => {
    let matches = matchImports.exec(atRule.params)
    if (matches) {
      let [, aliasesString, path] = matches
      // We can use constants for path names
      if (icssExports[path]) path = icssExports[path]
      let aliases = aliasesString
        .replace(/^\(\s*([\s\S]+)\s*\)$/, '$1')
        .split(/\s*,\s*/)
        .map(alias => {
          let tokens = matchImport.exec(alias)
          if (tokens) {
            let [, theirName, myName = theirName] = tokens
            let importedName = createImportedName(path, myName)
            icssExports[myName] = importedName
            return { theirName, importedName }
          } else {
            throw new Error(`@import statement "${alias}" is invalid!`)
          }
        })
        .reduce((acc, { theirName, importedName }) => {
          acc[importedName] = theirName
          return acc
        }, {})
      icssImports[path] = Object.assign({}, icssImports[path], aliases)
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

  if (Object.keys(icssExports).length === 0) return

  replaceSymbols(css, icssExports)

  css.prepend(createICSSRules(icssImports, icssExports))
})
