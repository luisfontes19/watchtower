import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { findFiles, isActiveTab, WorkspaceFile } from '../utils'
import { DevContainerFileAnalyzerParams, StaticAnalyzer } from './types'

export class DevContainerAnalyzer {

    static async analyze(options?: DevContainerFileAnalyzerParams): Promise<Finding[]> {
        const findings: Finding[] = []

        for (const devContainer of await findFiles(WorkspaceFile.DevContainer)) {
            findings.push(...await DevContainerAnalyzer.analyzeFile(devContainer))
        }

        return findings
    }

    static async analyzeFile(uri: vscode.Uri): Promise<Finding[]> {
        const findings: Finding[] = []
        const content = await vscode.workspace.fs.readFile(uri)
        const json = jsonc.parse(content.toString()) as Record<string, unknown>
        findings.push(...DevContainerAnalyzer.checkMcpServers(json))

        return findings
    }

    static checkMcpServers(json: Record<string, unknown>): Finding[] {
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

    static async onChange(uri: vscode.Uri): Promise<Finding[]> {
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

        findings.push(...await DevContainerAnalyzer.analyzeFile(uri))


        return findings

    }
}

const _checkStatic: StaticAnalyzer = DevContainerAnalyzer
