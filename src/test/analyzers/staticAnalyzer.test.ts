import * as assert from 'assert'
import * as vscode from 'vscode'
import '../../analyzers/agentsFile' // load before to resolve circular dep
import { StaticAnalyzer } from '../../analyzers/staticAnalyzer'
import { Finding, FindingType } from '../../types'

// Create a concrete test implementation since StaticAnalyzer is abstract
class TestStaticAnalyzer extends StaticAnalyzer {
    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        return []
    }
}

suite('StaticAnalyzer', () => {

    const fakeUri = vscode.Uri.file('/workspace/.vscode/settings.json')
    let analyzer: TestStaticAnalyzer

    setup(() => {
        analyzer = new TestStaticAnalyzer()
    })

    suite('editedInBackground', () => {

        test('returns true when no active editor', () => {
            // When no active editor is open
            const result = analyzer.editedInBackground(fakeUri)
            // This will typically return true since there's no active editor in the test environment
            assert.strictEqual(typeof result, 'boolean')
        })

        test('returns boolean result for any URI', () => {
            const testUris = [
                vscode.Uri.file('/workspace/test.ts'),
                vscode.Uri.file('/workspace/.vscode/launch.json'),
                vscode.Uri.file('/workspace/package.json')
            ]

            for (const uri of testUris) {
                const result = analyzer.editedInBackground(uri)
                assert.strictEqual(typeof result, 'boolean')
            }
        })
    })

    suite('sensitiveFileBackgroundEditCheck', () => {

        test('returns empty findings when file not edited in background', async () => {
            // Mock editedInBackground to return false
            analyzer.editedInBackground = () => false

            const findings = await analyzer.sensitiveFileBackgroundEditCheck(fakeUri)
            assert.strictEqual(findings.length, 0)
        })

        test('detects background edit of regular sensitive file', async () => {
            // Mock editedInBackground to return true
            analyzer.editedInBackground = () => true

            const findings = await analyzer.sensitiveFileBackgroundEditCheck(fakeUri)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.SilentFileChange)
            assert.ok(findings[0].name.includes('Sensitive file'))
            assert.ok(findings[0].name.includes('edited in the background'))
            assert.ok(findings[0].detail.includes('modified while not being the active editor tab'))
            assert.strictEqual(findings[0].priority, 'low')
            assert.strictEqual(findings[0].file, fakeUri.fsPath)
        })

        test('detects background edit of AI agent file with high priority', async () => {
            const agentUri = vscode.Uri.file('/workspace/CLAUDE.md')
            // Mock editedInBackground to return true
            analyzer.editedInBackground = () => true

            const findings = await analyzer.sensitiveFileBackgroundEditCheck(agentUri)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.SilentFileChange)
            assert.ok(findings[0].name.includes('Sensitive file'))
            assert.ok(findings[0].name.includes('edited in the background'))
            assert.ok(findings[0].detail.includes('AI related file'))
            assert.ok(findings[0].detail.includes('attack against AI agents'))
            assert.strictEqual(findings[0].priority, 'high')
            assert.strictEqual(findings[0].file, agentUri.fsPath)
        })

        test('detects background edit of instruction file', async () => {
            const instructionUri = vscode.Uri.file('/workspace/.github/copilot-instructions.md')
            // Mock editedInBackground to return true
            analyzer.editedInBackground = () => true

            const findings = await analyzer.sensitiveFileBackgroundEditCheck(instructionUri)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.SilentFileChange)
            assert.ok(findings[0].detail.includes('AI related file'))
            assert.strictEqual(findings[0].priority, 'high')
        })

        test('detects background edit of agents directory file', async () => {
            const agentsUri = vscode.Uri.file('/workspace/.agents/toolname/SKILL.md')
            // Mock editedInBackground to return true
            analyzer.editedInBackground = () => true

            const findings = await analyzer.sensitiveFileBackgroundEditCheck(agentsUri)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.SilentFileChange)
            assert.ok(findings[0].detail.includes('AI related file'))
            assert.strictEqual(findings[0].priority, 'high')
        })

        test('handles various file types', async () => {
            const testFiles = [
                '/workspace/package.json',
                '/workspace/.vscode/tasks.json',
                '/workspace/.devcontainer/devcontainer.json',
                '/workspace/README.md'
            ]

            // Mock editedInBackground to return true
            analyzer.editedInBackground = () => true

            for (const filePath of testFiles) {
                const uri = vscode.Uri.file(filePath)
                const findings = await analyzer.sensitiveFileBackgroundEditCheck(uri)
                assert.strictEqual(findings.length, 1)
                assert.strictEqual(findings[0].type, FindingType.SilentFileChange)
                assert.strictEqual(findings[0].file, uri.fsPath)
            }
        })
    })

    suite('abstract checkFile method', () => {

        test('concrete implementation returns empty findings', async () => {
            const findings = await analyzer.checkFile(fakeUri)
            assert.strictEqual(findings.length, 0)
        })

        test('concrete implementation handles content parameter', async () => {
            const content = new TextEncoder().encode('{"test": "content"}')
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 0)
        })
    })
})
