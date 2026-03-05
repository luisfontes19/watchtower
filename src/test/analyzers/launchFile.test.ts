import * as assert from 'assert'
import * as vscode from 'vscode'
import '../../analyzers/agentsFile' // load before to resolve circular dep
import { LaunchAnalyzer } from '../../analyzers/launchFile'
import { FindingType } from '../../types'

suite('LaunchAnalyzer', () => {

    const fakeUri = vscode.Uri.file('/workspace/.vscode/launch.json')
    let analyzer: LaunchAnalyzer

    setup(() => {
        analyzer = new LaunchAnalyzer()
    })

    suite('checkFile', () => {

        test('returns empty findings for clean launch configuration', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                configurations: [{
                    type: "node",
                    request: "launch",
                    name: "Launch Program",
                    // No custom program or hidden presentation
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 0)
        })

        test('detects custom program path', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                configurations: [{
                    type: "node",
                    request: "launch",
                    name: "Launch Custom",
                    program: "/usr/local/bin/custom-binary"
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.Configuration)
            assert.ok(findings[0].name.includes("Launch Custom"))
            assert.ok(findings[0].name.includes("custom program"))
            assert.ok(findings[0].detail.includes("Custom program"))
            assert.ok(findings[0].detail.includes("/usr/local/bin/custom-binary"))
            assert.strictEqual(findings[0].priority, 'low')
        })

        test('detects hidden presentation', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                configurations: [{
                    type: "node",
                    request: "launch",
                    name: "Hidden Config",
                    presentation: {
                        hidden: true
                    }
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.Configuration)
            assert.ok(findings[0].name.includes("Hidden Config"))
            assert.ok(findings[0].name.includes("hidden from UI"))
            assert.ok(findings[0].detail.includes("Hidden configuration"))
            assert.strictEqual(findings[0].priority, 'low')
        })

        test('detects both custom program and hidden presentation with medium priority', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                configurations: [{
                    type: "node",
                    request: "launch",
                    name: "Suspicious Config",
                    program: "/malicious/binary",
                    presentation: {
                        hidden: true
                    }
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.Configuration)
            assert.ok(findings[0].name.includes("Suspicious Config"))
            assert.ok(findings[0].name.includes("custom program"))
            assert.ok(findings[0].name.includes("hidden from UI"))
            assert.ok(findings[0].detail.includes("Custom program"))
            assert.ok(findings[0].detail.includes("Hidden configuration"))
            assert.strictEqual(findings[0].priority, 'medium')
        })

        test('handles configuration without name using type', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                configurations: [{
                    type: "python",
                    request: "launch",
                    program: "/suspicious/script.py"
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 1)
            assert.ok(findings[0].name.includes("python"))
        })

        test('handles configuration without name or type', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                configurations: [{
                    request: "launch",
                    program: "/unknown/binary"
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 1)
            assert.ok(findings[0].name.includes("unknown"))
        })

        test('handles missing configurations array', async () => {
            const content = new TextEncoder().encode(JSON.stringify({}))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 0)
        })

        test('handles multiple configurations', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                configurations: [
                    {
                        type: "node",
                        request: "launch",
                        name: "Clean Config"
                    },
                    {
                        type: "node",
                        request: "launch",
                        name: "Suspicious Config",
                        program: "/malicious/binary"
                    }
                ]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 1)
            assert.ok(findings[0].name.includes("Suspicious Config"))
        })
    })
})
