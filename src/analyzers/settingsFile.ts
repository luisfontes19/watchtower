import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

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
                        type: FindingType.BinaryChange,
                        name: `Custom Interpreter Path defined in ${vscode.workspace.asRelativePath(uri)}`,
                        detail: `Setting "${currentPath}" points to a custom interpreter path: "${value}". This could be an attempt to execute arbitrary binaries.`,
                        priority: 'high',
                        file: uri.fsPath
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
}
