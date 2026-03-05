import * as assert from 'assert'
import * as vscode from 'vscode'
import { AgentsAnalyzer } from '../../analyzers/agentsFile'
suite('AgentsAnalyzer', () => {

    suite('.isAgentFile matching paths', () => {

        test('CLAUDE.md at root', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('CLAUDE.md')), true)
        })

        test('.github/copilot-instructions.md', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('.github/copilot-instructions.md')), true)
        })

        test('.github/instructions/foo.instructions.md', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('.github/instructions/foo.instructions.md')), true)
        })

        test('.github/instructions/my-rules.instructions.md', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('.github/instructions/my-rules.instructions.md')), true)
        })

        test('AGENTS.md at root', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('AGENTS.md')), true)
        })


        test('.agents/SKILL.md (direct child', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('.agents/SKILL.md')), true)
        })

        test('.agents/toolname/SKILL.md', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('.agents/toolname/SKILL.md')), true)
        })

        test('.agents/deep/nested/path/SKILL.md', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('.agents/deep/nested/path/SKILL.md')), true)
        })
    })

    suite('.isAgentFile non-matching paths', () => {

        test('CLAUDE.md in subdirectory', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('sub/CLAUDE.md')), false)
        })

        test('prefixed AGENTS.md (MY-AGENTS.md)', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('MY-AGENTS.md')), false)
        })


        test('claude.md lowercase', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('claude.md')), false)
        })

        test('copilot-instructions.md at root', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('copilot-instructions.md')), false)
        })

        test('.github/instructions/sub/foo.instructions.md (single * should not cross /)', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('.github/instructions/sub/foo.instructions.md')), false)
        })

        test('.github/instructions/foo.md (missing .instructions prefix)', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('.github/instructions/foo.md')), false)
        })

        test('.agents/toolname/OTHER.md', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('.agents/toolname/OTHER.md')), false)
        })

        test('README.md', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('README.md')), false)
        })

        test('src/index.ts', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('src/index.ts')), false)
        })

        test('empty string', () => {
            assert.strictEqual(AgentsAnalyzer.isAgentFile(vscode.Uri.file('')), false)
        })
    })

    suite('AGENTS_FILE_NAMES', () => {

        test('contains expected patterns', () => {
            assert.ok(AgentsAnalyzer.AGENTS_FILE_NAMES.includes('CLAUDE.md'))
            assert.ok(AgentsAnalyzer.AGENTS_FILE_NAMES.includes('.github/copilot-instructions.md'))
            assert.ok(AgentsAnalyzer.AGENTS_FILE_NAMES.includes('**/AGENTS.md'))
        })

        test('is not empty', () => {
            assert.ok(AgentsAnalyzer.AGENTS_FILE_NAMES.length > 0)
        })
    })
})
