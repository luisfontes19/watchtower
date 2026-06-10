import * as assert from 'assert'
import * as vscode from 'vscode'
import { NpmrcAnalyzer } from '../../analyzers/npmrcFile'
import { FindingType } from '../../types'

suite('NpmrcAnalyzer', () => {

    let analyzer: NpmrcAnalyzer

    setup(() => {
        analyzer = new NpmrcAnalyzer()
    })

    suite('canScanFile', () => {

        test('returns true for .npmrc files', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/.npmrc')), true)
        })

        test('returns false for non-.npmrc files', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/package.json')), false)
        })
    })

    suite('checkFile', () => {

        test('detects command-config keys in .npmrc', async () => {
            const uri = vscode.Uri.file('/project/.npmrc')
            const content = new TextEncoder().encode([
                'registry=https://registry.npmjs.org/',
                'shell=/bin/bash',
                'script-shell=node',
            ].join('\n'))

            const findings = await analyzer.checkFile(uri, content)
            assert.strictEqual(findings.length, 2)
            assert.strictEqual(findings[0].type, FindingType.Configuration)
            assert.strictEqual(findings[0].priority, 'high')
            assert.ok(findings[0].name.includes('shell'))
            assert.ok(findings[1].name.includes('script-shell'))
        })

        test('detects all requested keys', async () => {
            const uri = vscode.Uri.file('/project/.npmrc')
            const content = new TextEncoder().encode([
                'call=echo',
                'editor=vim',
                'git=/usr/bin/git',
                'script-shell=/bin/zsh',
                'shell=/bin/bash'
            ].join('\n'))

            const findings = await analyzer.checkFile(uri, content)
            assert.strictEqual(findings.length, 5)
            const names = findings.map(f => f.name)
            assert.ok(names.some(n => n.includes("'call'")))
            assert.ok(names.some(n => n.includes("'editor'")))
            assert.ok(names.some(n => n.includes("'git'")))
            assert.ok(names.some(n => n.includes("'script-shell'")))
            assert.ok(names.some(n => n.includes("'shell'")))
        })

        test('ignores comments and unrelated keys', async () => {
            const uri = vscode.Uri.file('/project/.npmrc')
            const content = new TextEncoder().encode([
                '# shell=/bin/bash',
                '; script-shell=/bin/zsh',
                'registry=https://registry.npmjs.org/',
                'strict-ssl=true'
            ].join('\n'))

            const findings = await analyzer.checkFile(uri, content)
            assert.strictEqual(findings.length, 0)
        })
    })

    suite('alertOnEditedInBackground', () => {

        test('returns true', () => {
            assert.strictEqual(analyzer.alertOnEditedInBackground(), true)
        })
    })
})
