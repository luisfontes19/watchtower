import * as assert from 'assert'
import * as vscode from 'vscode'
import '../../analyzers/agentsFile' // load before to resolve circular dep
import { JsonFile } from '../../analyzers/jsonFile'
import { FindingType } from '../../types'

suite('JsonFile', () => {

    const fakeUri = vscode.Uri.file('/workspace/config.json')
    let analyzer: JsonFile

    setup(() => {
        analyzer = new (JsonFile as any)()
    })

    suite('checkSchemaUrl', () => {

        test('returns empty findings for URL without query params', () => {
            const findings = analyzer.checkSchemaUrl('https://json-schema.org/draft/2020-12/schema', fakeUri)
            assert.strictEqual(findings.length, 0)
        })

        test('returns empty findings for URL with short, few params', () => {
            const findings = analyzer.checkSchemaUrl('https://schema.org/Person?v=1&lang=en', fakeUri)
            assert.strictEqual(findings.length, 0)
        })

        test('detects too many query parameters (>10)', () => {
            const url = 'https://schema.org/Person?' + Array.from({ length: 11 }, (_, i) => `p${i}=v${i}`).join('&')
            const findings = analyzer.checkSchemaUrl(url, fakeUri)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.JsonSchema)
            assert.ok(findings[0].name.includes('Too many query params'))
            assert.ok(findings[0].detail.includes('11'))
            assert.strictEqual(findings[0].priority, 'medium')
        })

        test('detects long parameter names (>30 chars)', () => {
            const longName = 'a'.repeat(31)
            const findings = analyzer.checkSchemaUrl(`https://schema.org/Person?${longName}=value`, fakeUri)
            assert.strictEqual(findings.length, 1)
            assert.ok(findings[0].name.includes('Big query param name'))
            assert.ok(findings[0].detail.includes(longName))
            assert.ok(findings[0].detail.includes('31'))
        })

        test('detects long parameter values (>30 chars)', () => {
            const longValue = 'b'.repeat(31)
            const findings = analyzer.checkSchemaUrl(`https://schema.org/Person?key=${longValue}`, fakeUri)
            assert.strictEqual(findings.length, 1)
            assert.ok(findings[0].name.includes('Big query param value'))
            assert.ok(findings[0].detail.includes(longValue))
            assert.ok(findings[0].detail.includes('31'))
        })

        test('detects multiple issues in same URL', () => {
            const longName = 'x'.repeat(35)
            const longValue = 'y'.repeat(40)
            const url = `https://schema.org/Person?${longName}=${longValue}&` + Array.from({ length: 10 }, (_, i) => `p${i}=v${i}`).join('&')
            const findings = analyzer.checkSchemaUrl(url, fakeUri)
            assert.ok(findings.length >= 2) // at least long name + long value
            const types = findings.map(f => f.name)
            assert.ok(types.some(n => n.includes('Big query param name')))
            assert.ok(types.some(n => n.includes('Big query param value')))
        })

        test('finding file path matches input', () => {
            const longName = 'suspicious'.repeat(5)
            const findings = analyzer.checkSchemaUrl(`https://schema.org/Person?${longName}=val`, fakeUri)
            assert.strictEqual(findings[0].file, fakeUri.fsPath)
        })
    })

    suite('checkFile', () => {

        test('returns empty findings for JSON without $schema', () => {
            const content = new TextEncoder().encode('{"name": "test"}')
            return analyzer.checkFile(fakeUri, content).then(findings => {
                assert.strictEqual(findings.length, 0)
            })
        })

        test('returns empty findings for non-JSON content', () => {
            const content = new TextEncoder().encode('not json')
            return analyzer.checkFile(fakeUri, content).then(findings => {
                assert.strictEqual(findings.length, 0)
            })
        })

        test('analyzes $schema URL when present', () => {
            const longParam = 'x'.repeat(35)  // 35 chars > 30 threshold
            const schemaUrl = `https://schema.org/Person?${longParam}=test`

            // Test the URL directly first
            const directFindings = analyzer.checkSchemaUrl(schemaUrl, fakeUri)
            assert.strictEqual(directFindings.length, 1, 'Direct checkSchemaUrl should find 1 issue')

            // Then test via checkFile
            const json = { "$schema": schemaUrl, "name": "John" }
            const content = new TextEncoder().encode(JSON.stringify(json))
            return analyzer.checkFile(fakeUri, content).then(findings => {
                assert.strictEqual(findings.length, 1, 'checkFile should also find 1 issue')
                assert.ok(findings[0].name.includes('Big query param name'))
            })
        })

        test('handles JSONC (JSON with comments)', () => {
            const jsonc = '{\n  // comment\n  "$schema": "https://schema.org/Person?param=value"\n}'
            const content = new TextEncoder().encode(jsonc)
            return analyzer.checkFile(fakeUri, content).then(findings => {
                assert.strictEqual(findings.length, 0)  // clean schema, no issues
            })
        })
    })
})
