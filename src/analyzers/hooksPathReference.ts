import * as vscode from 'vscode'
import { rule } from '../rules'
import { Finding, FindingType } from '../types'
import { rangeFromOffset } from '../utils'
import { StaticAnalyzer } from './staticAnalyzer'

const REFERENCES = ['https://luisfontes19.github.io/living-of-the-code/#git-hooks', 'https://opensourcemalware.com/blog/dprk-git-hooks-malware/']

export class HooksPathReferenceAnalyzer extends StaticAnalyzer {

    public static readonly HOOKS_PATH_PATTERN = /git\s+config\s+--get\s+core\.hooksPath/g

    alertOnEditedInBackground(): boolean {
        return false
    }

    canScanFile(uri: vscode.Uri): boolean {
        return uri.fsPath.endsWith('.md')
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const data = await this.ensureFileContent(uri, content)
        const text = new TextDecoder().decode(data)
        return this.detectHooksPathReferences(text, uri)
    }

    @rule('hooks-path-reference', 'Detects references to custom git hooks paths in markdown files')
    detectHooksPathReferences(text: string, uri: vscode.Uri): Finding[] {
        const file = vscode.workspace.asRelativePath(uri, false)

        return [...text.matchAll(HooksPathReferenceAnalyzer.HOOKS_PATH_PATTERN)].map(match => ({
            type: FindingType.GitHook,
            name: `Reference to custom git hooks path in ${vscode.workspace.asRelativePath(uri)}`,
            detail: `This markdown file mentions \`git config --get core.hooksPath\`, which is typically used to configure a custom location for git hooks. A non-standard hooks path can be used to hide hooks outside of the usual \`.git/hooks\` or \`.husky\` folders, where they may execute arbitrary commands on git events without being noticed. Inspect the referenced hooks folder and review every hook script carefully to make sure its contents are legitimate.`,
            priority: 'medium',
            file,
            range: rangeFromOffset(text, match.index!, match.index! + match[0].length),
            references: REFERENCES
        }) as Finding)
    }
}
