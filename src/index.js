const postcss = require('postcss')
const { default: replaceSymbols, replaceAll } = require('icss-replace-symbols')
const { genICSSRules } = require('./icss.js')

const matchImports = /^(.+?|\([\s\S]+?\))\s+from\s+("[^"]*"|'[^']*'|[\w-]+)$/
const matchValueDefinition = /(?:\s+|^)([\w-]+):?\s+(.+?)\s*$/g
const matchImport = /^([\w-]+)(?:\s+as\s+([\w-]+))?/

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
            let [, theirName, myName = theirName] = tokens
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

  css.prepend(genICSSRules(importAliases, definitions))
})
