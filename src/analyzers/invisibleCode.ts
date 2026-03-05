


import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { isActiveTab } from '../utils'
import { StaticAnalyzer } from './types'

export class InvisibleCodeAnalyzer extends StaticAnalyzer {

    public static readonly INVISIBLE_PATTERN = /[\u{E0000}-\u{E007F}]{5,}/u

    async analyze(): Promise<Finding[]> {
        return []
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const findings: Finding[] = []
        const data = content ?? await vscode.workspace.fs.readFile(uri)
        const text = new TextDecoder().decode(data)
        const matches = text.match(InvisibleCodeAnalyzer.INVISIBLE_PATTERN)
        if (matches) {
            for (const match of matches) {
                findings.push({
                    type: FindingType.SilentFileChange,
                    name: 'Invisible Code Detected',
                    detail: `Invisible code detected: "${match}"`,
                    severity: 'high',
                    file: ''
                })
            }
        }
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

