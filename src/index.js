import postcss from 'postcss'
import replaceSymbols from 'icss-replace-symbols'

const matchImports = /^(.+?)\s+from\s+("[^"]*"|'[^']*'|[\w-]+)$/
const matchLet = /(?:,\s+|^)([\w-]+):?\s+("[^"]*"|'[^']*'|[^,]+)\s?/g
const matchImport = /^([\w-]+)(?:\s+as\s+([\w-]+))?/
let options = {}
let importIndex = 0
let createImportedName = options && options.createImportedName || ((importName/*, path*/) => `i__const_${importName.replace(/\W/g, '_')}_${importIndex++}`)

export default css => {
  /* Find any local let rules and store them*/
  let translations = {}
  css.walkAtRules(/^value$/, atRule => {
    let matches
    while (matches = matchLet.exec(atRule.params)) {
      let [/*match*/, key, value] = matches
      translations[key] = value
      atRule.remove()
    }
  })

  /* We want to export anything defined by now, but don't add it to the CSS yet or
  it well get picked up by the replacement stuff */
  let exportDeclarations = Object.keys(translations).map(key => postcss.decl({
    value: translations[key],
    prop: key,
    before: "\n  ",
    _autoprefixerDisabled: true
  }))

  /* Find imports and insert ICSS tmp vars */
  let importAliases = []
  css.walkAtRules(/^import(-value)?$/, atRule => {
    let matches = matchImports.exec(atRule.params)
    if (matches) {
      let [/*match*/, aliases, path] = matches
      // We can use constants for path names
      if (translations[path]) path = translations[path]
      let imports = aliases.split(/\s*,\s*/).map(alias => {
        let tokens = matchImport.exec(alias)
        if (tokens) {
          let [/*match*/, theirName, myName = theirName] = tokens
          let importedName = createImportedName(myName)
          translations[myName] = importedName
          return {theirName, importedName}
        } else {
          throw new Error(`@import statement "${alias}" is invalid!`)
        }
      })
      importAliases.push({path, imports})
      atRule.remove()
    }
  })

  /* If we have no translations, don't continue */
  if (!Object.keys(translations).length) return

  /* Perform replacements */
  replaceSymbols(css, translations)

  /* Add import rules */
  importAliases.forEach(({path, imports}) => {
    css.prepend(postcss.rule({
      selector: `:import(${path})`,
      after: "\n",
      nodes: imports.map(({theirName, importedName}) => postcss.decl({
        value: theirName,
        prop: importedName,
        before: "\n  ",
        _autoprefixerDisabled: true
      }))
    }))
  })

  /* Add export rules if any */
  if (exportDeclarations.length > 0) {
    css.prepend(postcss.rule({
      selector: `:export`,
      after: "\n",
      nodes: exportDeclarations
    }))
  }
}
