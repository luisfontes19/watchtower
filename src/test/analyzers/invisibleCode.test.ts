import * as assert from 'assert'
import * as vscode from 'vscode'
import '../../analyzers/agentsFile' // load before to resolve circular dep
import { InvisibleCodeAnalyzer } from '../../analyzers/invisibleCode'
import { FindingType } from '../../types'

suite('InvisibleCodeAnalyzer', () => {

    const fakeUri = vscode.Uri.file('/workspace/suspicious.ts')
    let analyzer: InvisibleCodeAnalyzer

    setup(() => {
        analyzer = new (InvisibleCodeAnalyzer as any)()
    })

    suite('INVISIBLE_PATTERN', () => {

        test('matches 5+ consecutive tag characters (U+E0000–U+E007F)', () => {
            const invisible = '\u{E0061}\u{E0062}\u{E0063}\u{E0064}\u{E0065}'
            assert.ok(InvisibleCodeAnalyzer.INVISIBLE_PATTERN.test(invisible))
        })

        test('does not match fewer than 5 tag characters', () => {
            const short = '\u{E0061}\u{E0062}\u{E0063}\u{E0064}'
            assert.strictEqual(InvisibleCodeAnalyzer.INVISIBLE_PATTERN.test(short), false)
        })

        test('does not match normal ASCII text', () => {
            assert.strictEqual(InvisibleCodeAnalyzer.INVISIBLE_PATTERN.test('hello world'), false)
        })

        test('does not match other Unicode ranges', () => {
            assert.strictEqual(InvisibleCodeAnalyzer.INVISIBLE_PATTERN.test('\u200B\u200B\u200B\u200B\u200B'), false)
        })
    })

    suite('checkFile', () => {

        test('returns empty findings for clean content', () => {
            const content = new TextEncoder().encode('const x = 1;\nconsole.log(x);')
            return analyzer.checkFile(fakeUri, content).then(findings => {
                assert.strictEqual(findings.length, 0)
            })
        })

        test('detects invisible characters in content', () => {
            const invisible = '\u{E0061}\u{E0062}\u{E0063}\u{E0064}\u{E0065}\u{E0066}'
            const content = new TextEncoder().encode('const x = "' + invisible + '";')
            return analyzer.checkFile(fakeUri, content).then(findings => {
                assert.strictEqual(findings.length, 1)
                assert.strictEqual(findings[0].type, FindingType.InvisibleCode)
                assert.strictEqual(findings[0].priority, 'high')
                assert.strictEqual(findings[0].file, fakeUri.fsPath)
            })
        })

        test('finding detail includes character count', () => {
            const invisible = '\u{E0061}'.repeat(10)
            const content = new TextEncoder().encode(invisible)
            return analyzer.checkFile(fakeUri, content).then(findings => {
                // each tag char is a surrogate pair, so match.length = 20
                assert.ok(findings[0].detail.includes('20'))
            })
        })

        test('returns empty findings for empty content', () => {
            const content = new TextEncoder().encode('')
            return analyzer.checkFile(fakeUri, content).then(findings => {
                assert.strictEqual(findings.length, 0)
            })
        })

        test('invisible characters mixed in normal code are detected', () => {
            const invisible = '\u{E0041}\u{E0042}\u{E0043}\u{E0044}\u{E0045}'
            const content = new TextEncoder().encode('// comment\n' + invisible + '\nmore code')
            return analyzer.checkFile(fakeUri, content).then(findings => {
                assert.strictEqual(findings.length, 1)
            })
        })
    })
})
