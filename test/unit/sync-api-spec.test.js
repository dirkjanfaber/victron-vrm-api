// test/unit/sync-api-spec.test.js
const path = require('path')

// Importing must not start a sync: the script takes its output directory
// from process.argv[2], which under Jest is this test file
const fetchSpy = jest.spyOn(global, 'fetch')
const { extractRefs, resolveRef, mirrorPath, BASE_URL } = require('../../scripts/sync-api-spec')

describe('sync-api-spec', () => {
  it('should not fetch anything when imported', () => {
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  describe('extractRefs', () => {
    it('should find block-style refs, quoted or not', () => {
      const text = [
        "    - $ref: '../../../docs/components.yaml#/components/parameters/authorization'",
        '    $ref: "../Commands/User/docs/AddSiteCommand.yaml"',
        '    $ref: ../Commands/docs/LogoutEverywhereCommand.yaml'
      ].join('\n')

      expect(extractRefs(text)).toEqual([
        '../../../docs/components.yaml',
        '../Commands/User/docs/AddSiteCommand.yaml',
        '../Commands/docs/LogoutEverywhereCommand.yaml'
      ])
    })

    it('should find refs with a quoted key, as in JSON', () => {
      expect(extractRefs('{ "$ref": "other.json" }')).toEqual(['other.json'])
      expect(extractRefs("'$ref': 'other.yaml'")).toEqual(['other.yaml'])
    })

    it('should stop at flow-mapping and sequence delimiters', () => {
      expect(extractRefs('items: {$ref: ./schema.yaml}')).toEqual(['./schema.yaml'])
      expect(extractRefs('oneOf: [{$ref: a.yaml}, {$ref: b.yaml#/x}]')).toEqual(['a.yaml', 'b.yaml'])
      expect(extractRefs('{$ref: c.yaml, description: d}')).toEqual(['c.yaml'])
    })

    it('should skip refs within the same file', () => {
      expect(extractRefs("$ref: '#/components/schemas/DynamicEssConfiguration'")).toEqual([])
    })
  })

  describe('resolveRef', () => {
    const from = BASE_URL + 'Commands/Installation/docs/StatsCommand.yaml'

    it('should resolve a ref relative to the referencing file', () => {
      expect(resolveRef('../../../docs/components.yaml', from)).toBe(BASE_URL + 'docs/components.yaml')
    })

    it('should drop a query string or fragment, which could otherwise smuggle ../ into the file path', () => {
      expect(resolveRef('../payload.yaml?x=/../../escaped.txt', from)).toBe(BASE_URL + 'Commands/Installation/payload.yaml')
      expect(resolveRef('x.yaml#frag', from)).toBe(BASE_URL + 'Commands/Installation/docs/x.yaml')
    })
  })

  describe('mirrorPath', () => {
    const outDir = path.resolve('/tmp/mirror/api-spec')

    it('should place files inside the mirror directory', () => {
      expect(mirrorPath(outDir, 'Commands/User/docs/InfoMeCommand.yaml')).toBe(path.join(outDir, 'Commands/User/docs/InfoMeCommand.yaml'))
    })

    it('should refuse paths that resolve outside the mirror directory', () => {
      expect(() => mirrorPath(outDir, 'docs/x.yaml?q=/../../../../package.json')).toThrow(/outside/)
      expect(() => mirrorPath(outDir, '../api-spec-evil/x.yaml')).toThrow(/outside/)
    })
  })
})
