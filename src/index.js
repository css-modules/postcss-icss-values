/* eslint-env node */
import postcss from "postcss";
import valueParser from "postcss-value-parser";
import {
  replaceSymbols,
  replaceValueSymbols,
  extractICSS,
  createICSSRules
} from "icss-utils";
import findLastIndex from "lodash/findLastIndex";
import dropWhile from "lodash/dropWhile";
import dropRightWhile from "lodash/dropRightWhile";
import fromPairs from "lodash/fromPairs";

const plugin = "postcss-modules-values";

const chunkBy = (collection, iteratee) =>
  collection.reduce(
    (acc, item) =>
      iteratee(item)
        ? [...acc, []]
        : [...acc.slice(0, -1), [...acc[acc.length - 1], item]],
    [[]]
  );

const isWord = node => node.type === "word";

const isDiv = node => node.type === "div";

const isSpace = node => node.type === "space";

const isNotSpace = node => !isSpace(node);

const isFromWord = node => isWord(node) && node.value === "from";

const isAsWord = node => isWord(node) && node.value === "as";

const isComma = node => isDiv(node) && node.value === ",";

const isColon = node => isDiv(node) && node.value === ":";

const isInitializer = node => isColon(node) || isSpace(node);

const trimNodes = nodes => dropWhile(dropRightWhile(nodes, isSpace), isSpace);

const getPathValue = nodes =>
  nodes.length === 1 && nodes[0].type === "string" ? nodes[0].value : null;

const ensurePairsList = valuesNodes =>
  valuesNodes.length === 1 && valuesNodes[0].type === "function"
    ? valuesNodes[0].nodes
    : valuesNodes;

const getAliasesPairs = valuesNodes =>
  chunkBy(ensurePairsList(valuesNodes), isComma).map(pairNodes => {
    const nodes = pairNodes.filter(isNotSpace);
    if (nodes.length === 1 && isWord(nodes[0])) {
      return [nodes[0].value, nodes[0].value];
    }
    if (
      nodes.length === 3 &&
      isWord(nodes[0]) &&
      isAsWord(nodes[1]) &&
      isWord(nodes[2])
    ) {
      return [nodes[0].value, nodes[2].value];
    }
    return null;
  });

const parse = value => {
  const parsed = valueParser(value).nodes;
  const fromIndex = findLastIndex(parsed, isFromWord);
  if (fromIndex === -1) {
    if (parsed.length > 2 && isWord(parsed[0]) && isInitializer(parsed[1])) {
      return {
        type: "value",
        name: parsed[0].value,
        value: valueParser.stringify(trimNodes(parsed.slice(2)))
      };
    }
    return null;
  }
  const pairs = getAliasesPairs(trimNodes(parsed.slice(0, fromIndex)));
  const path = getPathValue(trimNodes(parsed.slice(fromIndex + 1)));
  if (pairs.every(Boolean) && path) {
    return {
      type: "import",
      pairs,
      path
    };
  }
  return null;
};

const getAliasName = (name, index) =>
  `__value__${name.replace(/\W/g, "_")}__${index}`;

// TODO forbig '.' and '#' in names

module.exports = postcss.plugin(plugin, () => (css, result) => {
  const { icssImports, icssExports } = extractICSS(css);
  let importIndex = 0;
  const createImportedName = (path, name) => {
    const importedName = getAliasName(name, importIndex);
    importIndex += 1;
    return importedName;
  };

  css.walkAtRules("value", atRule => {
    if (atRule.params.indexOf("@value") !== -1) {
      result.warn(`Invalid value definition "${atRule.params}"`, {
        node: atRule
      });
    } else {
      const parsed = parse(atRule.params);
      if (parsed) {
        if (parsed.type === "value") {
          if (icssExports[parsed.name]) {
            result.warn(`"${parsed.name}" value already declared`, {
              node: atRule
            });
          }
          icssExports[parsed.name] = replaceValueSymbols(
            parsed.value,
            icssExports
          );
        }
        if (parsed.type === "import") {
          const pairs = parsed.pairs.map(([key, value]) => {
            let importedName = createImportedName(parsed.path, value);
            if (icssExports[value]) {
              result.warn(`"${value}" value already declared`, {
                node: atRule
              });
            }
            icssExports[value] = importedName;
            return [importedName, key];
          });
          const aliases = fromPairs(pairs);
          icssImports[parsed.path] = Object.assign(
            {},
            icssImports[parsed.path],
            aliases
          );
        }
      } else {
        result.warn(`Invalid value definition "${atRule.params}"`, {
          node: atRule
        });
      }
    }
    atRule.remove();
  });

  replaceSymbols(css, icssExports);

  css.prepend(createICSSRules(icssImports, icssExports));
});
