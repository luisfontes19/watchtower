import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

export class DevContainerAnalyzer extends StaticAnalyzer {

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const findings: Finding[] = []
        const data = content ?? await vscode.workspace.fs.readFile(uri)
        const json = jsonc.parse(data.toString()) as Record<string, unknown>
        findings.push(...this.checkMcpServers(json, uri))

        return findings
    }

    checkMcpServers(json: Record<string, unknown>, uri: vscode.Uri): Finding[] {
        const findings: Finding[] = []
        const servers = (((json?.customizations as Record<string, unknown>)?.vscode as Record<string, unknown>)?.mcp as Record<string, unknown>)?.servers as Record<string, unknown> | undefined
        for (const serverName of Object.keys(servers ?? {})) {
            findings.push({
                type: FindingType.McpServer,
                name: `Detected MCP Server '${serverName}' in devcontainer.json`,
                detail: `A MCP server named '${serverName}' was detected in devcontainer.json. MCP servers can execute arbitrary commands and may pose a security risk if not properly secured. Please review the server configuration to ensure it is safe.`,
                priority: 'medium',
                file: uri.fsPath
            })
        }
        return findings
    }
}
