import * as vscode from 'vscode'
import { rule } from '../rules'
import { Finding, FindingType } from '../types'
import { rangeFromOffset } from '../utils'
import { StaticAnalyzer } from './staticAnalyzer'

export class NpmrcAnalyzer extends StaticAnalyzer {

    private static readonly COMMAND_CONFIG_KEYS = ['call', 'editor', 'git', 'script-shell', 'shell']

    alertOnEditedInBackground(): boolean {
        return false
    }

    canScanFile(uri: vscode.Uri): boolean {
        const normalizedPath = uri.fsPath.replace(/\\/g, '/')
        return normalizedPath.endsWith('/.npmrc')
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const data = await this.ensureFileContent(uri, content)
        const text = new TextDecoder().decode(data)
        return this.detectCommandConfigs(text, uri)
    }

    @rule('npmrc-command-config', 'Detects .npmrc configs that can execute binary commands')
    detectCommandConfigs(text: string, uri: vscode.Uri): Finding[] {
        const findings: Finding[] = []
        const file = vscode.workspace.asRelativePath(uri, false)
        const lines = text.split(/\r?\n/)

        let offset = 0
        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
                offset += line.length + 1
                continue
            }

            const match = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=\s*(.+?)\s*$/)
            if (!match) {
                offset += line.length + 1
                continue
            }

            const key = match[1].toLowerCase()
            const value = match[2]
            if (!NpmrcAnalyzer.COMMAND_CONFIG_KEYS.includes(key)) {
                offset += line.length + 1
                continue
            }

            const keyStart = line.indexOf(match[1])
            findings.push({
                type: FindingType.Configuration,
                name: `Potential command-executing npm config '${match[1]}' in .npmrc`,
                detail: `The \.npmrc setting \`${match[1]}=${value}\` controls which executable or command npm invokes. Attackers can use this to run unexpected programs during npm operations. Verify this value is trusted and expected.`,
                priority: 'high',
                file,
                range: rangeFromOffset(text, offset + keyStart, offset + keyStart + match[1].length),
                references: ['https://luisfontes19.github.io/living-of-the-code/#npmrc']
            })

            offset += line.length + 1
        }

        return findings
    }
}
