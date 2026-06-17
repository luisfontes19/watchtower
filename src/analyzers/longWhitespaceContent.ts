import * as vscode from 'vscode'
import { rule } from '../rules'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

export class LongWhitespaceContentAnalyzer extends StaticAnalyzer {

    // Horizontal whitespace run before content on the same line.
    public static readonly LONG_WHITESPACE_WITH_CONTENT = /[ \t]{200,}(?=\S)/g

    alertOnEditedInBackground(): boolean {
        return false
    }

    canScanFile(uri: vscode.Uri): boolean {
        return super.isNotBinaryFile(uri)
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const data = await this.ensureFileContent(uri, content)

        const { isBinaryFile } = await import('isbinaryfile')
        if (await isBinaryFile(Buffer.from(data))) {
            return []
        }

        const text = new TextDecoder().decode(data)
        return this.findLongWhitespaceBeforeContent(text, uri)
    }

    @rule('long-whitespace-with-content', 'Detects long whitespace runs followed by content on the same line')
    findLongWhitespaceBeforeContent(text: string, uri: vscode.Uri): Finding[] {
        const relativePath = vscode.workspace.asRelativePath(uri)
        const file = vscode.workspace.asRelativePath(uri, false)

        return [...text.matchAll(LongWhitespaceContentAnalyzer.LONG_WHITESPACE_WITH_CONTENT)].map(match => ({
            type: FindingType.InvisibleCode,
            name: `Long whitespace obfuscation detected in ${relativePath}`,
            detail: `A long run of whitespace is immediately followed by content on the same line. This can hide code or make reviews miss malicious fragments pushed far to the right.`,
            priority: 'medium',
            file,
            range: this.rangeFromMatch(text, match),
        }))
    }

    private rangeFromMatch(text: string, match: RegExpMatchArray): vscode.Range {
        const start = match.index!
        const end = Math.min(text.length, start + match[0].length + 1)

        const startLines = text.slice(0, start).split(/\r?\n/)
        const endLines = text.slice(0, end).split(/\r?\n/)

        return new vscode.Range(
            startLines.length - 1, startLines[startLines.length - 1].length,
            endLines.length - 1, endLines[endLines.length - 1].length
        )
    }
}
