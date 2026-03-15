import * as assert from 'assert'
import * as vscode from 'vscode'
import '../../analyzers/agentsFile' // load before devcontainerFile to resolve circular dep
import { DevContainerAnalyzer } from '../../analyzers/devcontainerFile'
import { FindingType } from '../../types'

suite('DevContainerAnalyzer', () => {

    const fakeUri = vscode.Uri.file('/workspace/devcontainer.json')
    let analyzer: DevContainerAnalyzer

    setup(() => {
        analyzer = new (DevContainerAnalyzer as any)()
    })

    suite('checkMcpServers', () => {

        test('returns empty findings when no customizations', () => {
            const json = {}
            const findings = analyzer.checkMcpServers(json, fakeUri, JSON.stringify(json))
            assert.strictEqual(findings.length, 0)
        })

        test('returns empty findings when customizations has no vscode key', () => {
            const json = { customizations: {} }
            const findings = analyzer.checkMcpServers(json, fakeUri, JSON.stringify(json))
            assert.strictEqual(findings.length, 0)
        })

        test('returns empty findings when vscode has no mcp key', () => {
            const json = { customizations: { vscode: {} } }
            const findings = analyzer.checkMcpServers(json, fakeUri, JSON.stringify(json))
            assert.strictEqual(findings.length, 0)
        })

        test('returns empty findings when mcp has no servers key', () => {
            const json = { customizations: { vscode: { mcp: {} } } }
            const findings = analyzer.checkMcpServers(json, fakeUri, JSON.stringify(json))
            assert.strictEqual(findings.length, 0)
        })

        test('returns empty findings when servers is empty', () => {
            const json = { customizations: { vscode: { mcp: { servers: {} } } } }
            const findings = analyzer.checkMcpServers(json, fakeUri, JSON.stringify(json))
            assert.strictEqual(findings.length, 0)
        })

        test('detects a single MCP server', () => {
            const json = {
                customizations: {
                    vscode: {
                        mcp: {
                            servers: {
                                "my-server": { command: "node", args: ["server.js"] }
                            }
                        }
                    }
                }
            }
            const findings = analyzer.checkMcpServers(json, fakeUri, JSON.stringify(json))
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.McpServer)
            assert.ok(findings[0].name.includes('my-server'))
            assert.strictEqual(findings[0].priority, 'medium')
            assert.strictEqual(findings[0].file, fakeUri.fsPath)
        })

        test('detects multiple MCP servers', () => {
            const json = {
                customizations: {
                    vscode: {
                        mcp: {
                            servers: {
                                "server-a": { command: "a" },
                                "server-b": { command: "b" },
                                "server-c": { command: "c" }
                            }
                        }
                    }
                }
            }
            const findings = analyzer.checkMcpServers(json, fakeUri, JSON.stringify(json))
            assert.strictEqual(findings.length, 3)
            const names = findings.map(f => f.name)
            assert.ok(names.some(n => n.includes('server-a')))
            assert.ok(names.some(n => n.includes('server-b')))
            assert.ok(names.some(n => n.includes('server-c')))
        })

        test('finding detail mentions the server name', () => {
            const json = {
                customizations: {
                    vscode: {
                        mcp: {
                            servers: {
                                "dangerous-tool": { command: "rm", args: ["-rf", "/"] }
                            }
                        }
                    }
                }
            }
            const findings = analyzer.checkMcpServers(json, fakeUri, JSON.stringify(json))
            assert.ok(findings[0].detail.includes('dangerous-tool'))
        })

        test('finding name mentions devcontainer.json', () => {
            const json = {
                customizations: {
                    vscode: {
                        mcp: {
                            servers: {
                                "test-server": {}
                            }
                        }
                    }
                }
            }
            const findings = analyzer.checkMcpServers(json, fakeUri, JSON.stringify(json))
            assert.ok(findings[0].name.includes('devcontainer.json'))
        })
    })
})
