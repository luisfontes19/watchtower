import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { rangeFromJsonNode } from '../utils'
import { StaticAnalyzer } from './staticAnalyzer'

export class DevContainerAnalyzer extends StaticAnalyzer {

    alertOnEditedInBackground(): boolean {
        return false
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const findings: Finding[] = []
        const data = content ?? await vscode.workspace.fs.readFile(uri)
        const text = new TextDecoder().decode(data)
        const json = jsonc.parse(text) as Record<string, unknown>
        findings.push(...this.checkMcpServers(json, uri, text))

        return findings
    }

    canScanFile(uri: vscode.Uri): boolean {
        return uri.fsPath.endsWith('.devcontainer/devcontainer.json')
    }

    checkMcpServers(json: Record<string, unknown>, uri: vscode.Uri, text: string): Finding[] {
        const findings: Finding[] = []
        const servers = (((json?.customizations as Record<string, unknown>)?.vscode as Record<string, unknown>)?.mcp as Record<string, unknown>)?.servers as Record<string, unknown> | undefined
        for (const serverName of Object.keys(servers ?? {})) {
            findings.push({
                type: FindingType.McpServer,
                name: `Detected MCP Server '${serverName}' in devcontainer.json`,
                detail: `A MCP server named '${serverName}' was detected in devcontainer.json. MCP servers can execute arbitrary commands and may pose a security risk if not properly secured. Please review the server configuration to ensure it is safe.`,
                priority: 'medium',
                file: vscode.workspace.asRelativePath(uri, false),
                range: rangeFromJsonNode(text, ['customizations', 'vscode', 'mcp', 'servers', serverName])
            })
        }
        return findings
    }
}
