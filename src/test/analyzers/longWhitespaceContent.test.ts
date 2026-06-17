import * as assert from 'assert'
import * as vscode from 'vscode'
import '../../analyzers/agentsFile' // load before to resolve circular dep
import { LongWhitespaceContentAnalyzer } from '../../analyzers/longWhitespaceContent'
import { FindingType } from '../../types'

suite('LongWhitespaceContentAnalyzer', () => {

    const fakeUri = vscode.Uri.file('/workspace/suspicious.ts')
    let analyzer: LongWhitespaceContentAnalyzer

    setup(() => {
        analyzer = new LongWhitespaceContentAnalyzer()
    })

    suite('LONG_WHITESPACE_WITH_CONTENT', () => {
        test('matches long whitespace with content after it on the same line', () => {
            const text = `const a = 1;${' '.repeat(200)}evil()`
            assert.ok(text.match(LongWhitespaceContentAnalyzer.LONG_WHITESPACE_WITH_CONTENT))
        })

        test('does not match short whitespace runs', () => {
            const text = `const a = 1;${' '.repeat(120)}stillFine()`
            assert.strictEqual(Boolean(text.match(LongWhitespaceContentAnalyzer.LONG_WHITESPACE_WITH_CONTENT)), false)
        })

        test('does not match trailing whitespace with no content after', () => {
            const text = `const a = 1;${' '.repeat(220)}`
            assert.strictEqual(Boolean(text.match(LongWhitespaceContentAnalyzer.LONG_WHITESPACE_WITH_CONTENT)), false)
        })
    })

    suite('findLongWhitespaceBeforeContent', () => {
        test('returns a finding with expected type and metadata', () => {
            const text = `const a = 1;${' '.repeat(200)}dangerousCall()`

            const findings = analyzer.findLongWhitespaceBeforeContent(text, fakeUri)

            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.InvisibleCode)
            assert.strictEqual(findings[0].priority, 'medium')
            assert.ok(findings[0].name.includes('Long whitespace obfuscation detected'))
        })

        test('returns multiple findings when multiple suspicious lines exist', () => {
            const text = [
                `safeLine()`,
                `line1${' '.repeat(210)}hidden1()`,
                `line2${'\t'.repeat(200)}hidden2()`,
            ].join('\n')

            const findings = analyzer.findLongWhitespaceBeforeContent(text, fakeUri)
            assert.strictEqual(findings.length, 2)
        })
    })
})
