


import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

export class InvisibleCodeAnalyzer extends StaticAnalyzer {

    public static readonly INVISIBLE_PATTERN = /([\u{E0000}-\u{E007F}]+)/u

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const data = content ?? await vscode.workspace.fs.readFile(uri)
        const text = new TextDecoder().decode(data)
        const relativePath = vscode.workspace.asRelativePath(uri)
        const file = vscode.workspace.asRelativePath(uri, false)
        const regex = new RegExp(InvisibleCodeAnalyzer.INVISIBLE_PATTERN, 'gu')

        return [...text.matchAll(regex)].map(match => {
            const start = match.index!
            const end = start + match[0].length
            const highlightStart = Math.max(0, start - 1)
            const highlightEnd = Math.min(text.length, end + 1)
            const unicodeChars = [...match[0]].map(c => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(' ')
            const startLines = text.slice(0, highlightStart).split(/\r?\n/)
            const endLines = text.slice(0, highlightEnd).split(/\r?\n/)

            return {
                type: FindingType.InvisibleCode,
                name: `Invisible Code Detected on ${relativePath}`,
                detail: `Invisible code as the name suggests is code that is invisible to the user, it can be used to hide malicious code in plain sight. There is no legitimate reason to have invisible characters in code. Content:\n\`${unicodeChars}\``,
                priority: 'high',
                file,
                range: new vscode.Range(
                    startLines.length - 1, startLines[startLines.length - 1].length,
                    endLines.length - 1, endLines[endLines.length - 1].length
                )
            }
        })
    }
}

