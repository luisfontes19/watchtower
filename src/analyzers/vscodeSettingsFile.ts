import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { isActiveTab } from '../utils'
import { StaticAnalyzer } from './types'

export class SettingsAnalyzer extends StaticAnalyzer {

    // would be nice to detect changes to:
    //      chat.tools.autoApprove
    //      *.executablePath

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const findings: Finding[] = []
        const data = content ?? await vscode.workspace.fs.readFile(uri)
        const json = jsonc.parse(data.toString()) as Record<string, unknown>

        const findInterpreterPaths = (obj: unknown, path: string = ''): void => {
            if (obj === null || obj === undefined || typeof obj !== 'object') {
                return
            }
            for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
                const currentPath = path ? `${path}.${key}` : key
                if (key.toLowerCase().includes('interpreterpath')) {
                    findings.push({
                        type: FindingType.SilentFileChange,
                        name: 'Custom Interpreter Path Detected',
                        detail: `Setting "${currentPath}" points to a custom interpreter path: "${value}". This could be used to execute arbitrary binaries.`,
                        severity: 'high',
                    })
                }
                if (typeof value === 'object') {
                    findInterpreterPaths(value, currentPath)
                }
            }
        }

        findInterpreterPaths(json)

        return findings
    }

    async onChange(uri: vscode.Uri): Promise<Finding[]> {
        const findings: Finding[] = []

        const active = isActiveTab(uri)

        if (!active) {
            findings.push({
                type: FindingType.SilentFileChange,
                name: 'VSCode Settings Edited not by user ',
                detail: 'settings.json was modified while not being the active editor tab — it may have been changed by an extension or automated process',
                severity: 'high',
                file: uri.fsPath
            })
        }

        return findings
    }

}
