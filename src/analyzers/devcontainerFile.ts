import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { findFiles, isActiveTab, WorkspaceFile } from '../utils'
import { StaticAnalyzer } from './types'

export class DevContainerAnalyzer extends StaticAnalyzer {

    async analyze(): Promise<Finding[]> {
        const findings: Finding[] = []

        for (const devContainer of await findFiles(WorkspaceFile.DevContainer)) {
            findings.push(...await this.checkFile(devContainer))
        }

        return findings
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const findings: Finding[] = []
        const data = content ?? await vscode.workspace.fs.readFile(uri)
        const json = jsonc.parse(data.toString()) as Record<string, unknown>
        findings.push(...this.checkMcpServers(json))

        return findings
    }

    checkMcpServers(json: Record<string, unknown>): Finding[] {
        const findings: Finding[] = []
        const servers = (((json?.customizations as Record<string, unknown>)?.vscode as Record<string, unknown>)?.mcp as Record<string, unknown>)?.servers as Record<string, unknown> | undefined
        for (const serverName of Object.keys(servers ?? {})) {
            findings.push({
                type: FindingType.McpServer,
                name: 'MCP Server Detected',
                detail: `A MCP server named ${serverName} was detected in devcontainer.json, please verify its legitimacy and ensure it's not exposing sensitive data or functionality`,
                severity: 'medium'
            })
        }
        return findings
    }

    async onChange(uri: vscode.Uri): Promise<Finding[]> {
        const findings: Finding[] = []

        const active = isActiveTab(uri)

        if (!active) {
            findings.push({
                type: FindingType.SilentFileChange,
                name: 'DevContainer Edited not by user',
                detail: `The file ${uri.fsPath} was modified while not being the active editor tab — it may indicate an attack against devcontainer configuration`,
                severity: 'low',
                file: uri.fsPath
            })
        }

        findings.push(...await this.checkFile(uri))

        return findings
    }
}
