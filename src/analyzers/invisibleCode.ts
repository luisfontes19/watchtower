


import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

export class InvisibleCodeAnalyzer extends StaticAnalyzer {

    public static readonly INVISIBLE_PATTERN = /[\u{E0000}-\u{E007F}]{5,}/u

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const findings: Finding[] = []
        const data = content ?? await vscode.workspace.fs.readFile(uri)
        const text = new TextDecoder().decode(data)
        const matches = text.match(InvisibleCodeAnalyzer.INVISIBLE_PATTERN)

        if (matches) {
            for (const match of matches) {
                findings.push({
                    type: FindingType.SilentFileChange,
                    name: `Invisible Code Detected on ${vscode.workspace.asRelativePath(uri)}`,
                    detail: `Invisible code as the name suggests is code that is invisible to the user, it can be used to hide malicious code in plain sight. A sequence of ${match.length} invisible characters was detected in the file ${vscode.workspace.asRelativePath(uri)}. There is no legitimate reason to have invisible characters in code`,
                    priority: 'high',
                    file: uri.fsPath
                })
            }
        }
        return findings
    }
}

