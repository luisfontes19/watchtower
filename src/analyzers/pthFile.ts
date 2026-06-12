import * as vscode from 'vscode'
import { rule } from '../rules'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

export class PthFileAnalyzer extends StaticAnalyzer {

    alertOnEditedInBackground(): boolean {
        return true
    }

    canScanFile(uri: vscode.Uri): boolean {
        return uri.fsPath.replace(/\\/g, '/').endsWith('.pth')
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const data = await this.ensureFileContent(uri, content)
        const text = new TextDecoder().decode(data)
        return this.detectPthFile(text, uri)
    }

    @rule('python-pth-file', 'Detects Python .pth files that chain code execution after an import statement')
    detectPthFile(text: string, uri: vscode.Uri): Finding[] {
        const file = vscode.workspace.asRelativePath(uri, false)
        const lines = text.split(/\r?\n/)

        // Python's site module exec()s any line starting with "import ".
        // A semicolon after the import allows chaining arbitrary code execution.
        const hasChainedExecution = lines.some(
            line => /^\s*import\s[^;]+;/.test(line) && !line.trimStart().startsWith('#')
        )

        if (!hasChainedExecution) return []

        return [{
            type: FindingType.AutorunCode,
            name: `Python .pth file with chained code execution: ${file}`,
            detail: `Python \`.pth\` files in site-packages are processed by Python's \`site\` module on every startup. Lines beginning with \`import\` are executed via \`exec()\`, and a semicolon allows chaining arbitrary statements — e.g. \`import os; os.system("...")\`. This is a common supply-chain persistence technique. Review this file carefully to ensure it does not execute malicious code.`,
            priority: 'high',
            file,
            references: [
                'https://docs.python.org/3/library/site.html',
                'https://luisfontes19.github.io/living-of-the-code/#python-pth'
            ]
        }]
    }
}
