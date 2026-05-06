import * as assert from 'assert'
import * as vscode from 'vscode'
import { HooksPathReferenceAnalyzer } from '../../analyzers/hooksPathReference'
import { FindingType } from '../../types'

suite('HooksPathReferenceAnalyzer', () => {

    let analyzer: HooksPathReferenceAnalyzer

    setup(() => {
        analyzer = new HooksPathReferenceAnalyzer()
    })

    suite('canScanFile', () => {

        test('returns true for .md files', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/README.md')), true)
        })

        test('returns false for non-md files', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/src/index.ts')), false)
        })
    })

    suite('checkFile', () => {

        test('flags a markdown file mentioning git config --get core.hooksPath', async () => {
            const uri = vscode.Uri.file('/project/README.md')
            const text = 'Run `git config --get core.hooksPath` to see the configured path.'
            const findings = await analyzer.checkFile(uri, new TextEncoder().encode(text))
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.GitHook)
            assert.ok(findings[0].detail.includes('core.hooksPath'))
            assert.ok(findings[0].range)
        })

        test('does not flag a markdown file without the hooksPath mention', async () => {
            const uri = vscode.Uri.file('/project/README.md')
            const findings = await analyzer.checkFile(uri, new TextEncoder().encode('# A README\n\nHello world.'))
            assert.strictEqual(findings.length, 0)
        })

        test('flags multiple mentions in the same md file', async () => {
            const uri = vscode.Uri.file('/project/docs/setup.md')
            const text = 'git config --get core.hooksPath\nand again git config --get core.hooksPath'
            const findings = await analyzer.checkFile(uri, new TextEncoder().encode(text))
            assert.strictEqual(findings.length, 2)
        })
    })

    suite('alertOnEditedInBackground', () => {

        test('returns false', () => {
            assert.strictEqual(analyzer.alertOnEditedInBackground(), false)
        })
    })
})
