import * as assert from 'assert'
import * as vscode from 'vscode'
import '../../analyzers/agentsFile' // load before to resolve circular dep
import { InvisibleCodeAnalyzer } from '../../analyzers/invisibleCode'

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

        test('does not match "offending" emojis', () => {
            const emojis = '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
            assert.strictEqual(InvisibleCodeAnalyzer.INVISIBLE_PATTERN.test(emojis), false)
        })
    })


})
