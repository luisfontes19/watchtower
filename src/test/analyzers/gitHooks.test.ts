import * as assert from 'assert'
import * as vscode from 'vscode'
import { GitHooksAnalyzer } from '../../analyzers/gitHooks'
import { FindingType } from '../../types'

suite('GitHooksAnalyzer', () => {

    let analyzer: GitHooksAnalyzer

    setup(() => {
        analyzer = new GitHooksAnalyzer()
    })

    suite('canScanFile', () => {

        test('returns true for files inside .husky/', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/.husky/pre-commit')), true)
        })

        test('returns true for files inside .githooks/', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/.githooks/pre-push')), true)
        })

        test('returns false for husky internal _ folder', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/.husky/_/husky.sh')), false)
        })

        test('returns false for unrelated files', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/src/index.ts')), false)
        })

        test('returns false for .md files', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/README.md')), false)
        })
    })

    suite('isHuskyHook', () => {

        test('matches a hook in .husky/', () => {
            assert.strictEqual(GitHooksAnalyzer.isHuskyHook(vscode.Uri.file('/project/.husky/pre-commit')), true)
        })

        test('does not match files in .husky/_/', () => {
            assert.strictEqual(GitHooksAnalyzer.isHuskyHook(vscode.Uri.file('/project/.husky/_/husky.sh')), false)
        })

        test('does not match files outside .husky/', () => {
            assert.strictEqual(GitHooksAnalyzer.isHuskyHook(vscode.Uri.file('/project/.git/hooks/pre-commit')), false)
        })
    })

    suite('isGitHooksFolderHook', () => {

        test('matches a hook in .githooks/', () => {
            assert.strictEqual(GitHooksAnalyzer.isGitHooksFolderHook(vscode.Uri.file('/project/.githooks/pre-commit')), true)
        })

        test('does not match files outside .githooks/', () => {
            assert.strictEqual(GitHooksAnalyzer.isGitHooksFolderHook(vscode.Uri.file('/project/.husky/pre-commit')), false)
        })
    })

    suite('checkFile', () => {

        test('reports husky hook with GitHook finding pointing at the folder', async () => {
            const uri = vscode.Uri.file('/project/.husky/pre-commit')
            const findings = await analyzer.checkFile(uri, new TextEncoder().encode('#!/bin/sh\necho hi'))
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.GitHook)
            assert.ok(findings[0].name.toLowerCase().includes('husky'))
            assert.ok(findings[0].file.endsWith('.husky/'))
            assert.strictEqual(findings[0].priority, 'medium')
        })

        test('reports .githooks hook with GitHook finding pointing at the folder', async () => {
            const uri = vscode.Uri.file('/project/.githooks/pre-push')
            const findings = await analyzer.checkFile(uri, new TextEncoder().encode('#!/bin/sh'))
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.GitHook)
            assert.ok(findings[0].file.endsWith('.githooks/'))
        })

        test('does not report husky internal _ files', async () => {
            const uri = vscode.Uri.file('/project/.husky/_/husky.sh')
            const findings = await analyzer.checkFile(uri, new TextEncoder().encode(''))
            assert.strictEqual(findings.length, 0)
        })
    })

    suite('alertOnEditedInBackground', () => {

        test('returns true', () => {
            assert.strictEqual(analyzer.alertOnEditedInBackground(), true)
        })
    })
})
