/* global describe, it */

import postcss from 'postcss'
import assert from 'assert'

import constants from '../src'

const test = (input, expected) => {
  let processor = postcss([constants])
  assert.equal(processor.process(input).css, expected)
}

describe('constants', () => {
  it('should pass through an empty string', () => {
    test('','')
  })

  it('should export a constant', () => {
    test('@define red blue;',':export {\n  red: blue\n}')
  })
})

