import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { rangeFromJsonNode } from '../utils'
import { ExtensionsAnalyzer } from './extensions'
import { StaticAnalyzer } from './staticAnalyzer'

export class DevContainerAnalyzer extends StaticAnalyzer {

    alertOnEditedInBackground(): boolean {
        return false
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const data = content ?? await vscode.workspace.fs.readFile(uri)
        const textContent = new TextDecoder().decode(data)
        const json = jsonc.parse(textContent) as Record<string, any>

        const extensions = json?.recommendations as string[] | []

        const results = await ExtensionsAnalyzer.analyze(extensions)

        return results.filter(r => r.malicious === true).map(r => ({
            type: FindingType.MaliciousExtension,
            name: `Malicious extension '${r.extensionId}' recommended in extensions.json`,
            detail: `The extension '${r.extensionId}' is recommended in extensions.json and is flagged as potentially malicious.`,
            priority: 'high',
            file: vscode.workspace.asRelativePath(uri, false),
            range: rangeFromJsonNode(textContent, ['recommendations', r.extensionId])
        }))
    }

    canScanFile(uri: vscode.Uri): boolean {
        return uri.fsPath.endsWith('.vscode/extensions.json')
    }
}
