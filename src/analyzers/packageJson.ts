import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { isDangerousCommand } from '../dangerousCommands'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

export class PackageJsonAnalyzer extends StaticAnalyzer {
    alertOnEditedInBackground(): boolean {
        return false
    }

    canScanFile(uri: vscode.Uri): boolean {
        return uri.fsPath.endsWith('/package.json')
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const data = content ?? await vscode.workspace.fs.readFile(uri)
        const json = jsonc.parse(new TextDecoder().decode(data)) as Record<string, unknown>
        return this.checkPackageJson(json, uri)
    }

    checkPackageJson(json: Record<string, any>, uri: vscode.Uri): Finding[] {
        const findings: Finding[] = []
        if (!json.scripts?.preinstall) return findings

        const priority = isDangerousCommand(json.scripts.preinstall) ? 'high' : 'medium'

        findings.push({
            type: FindingType.PreinstallScript,
            name: `Detected preinstall script in package.json`,
            detail: `A preinstall script was detected in package.json. Preinstall scripts are a known attack vector for supply chain attacks, as they run before any dependencies are installed and can execute arbitrary code. Review the preinstall script to ensure it is safe.`,
            priority: priority,
            file: vscode.workspace.asRelativePath(uri, false)
        })

        return findings
    }
}
