import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { isDangerousCommand } from '../dangerousCommands'
import { Finding, FindingType } from '../types'
import { rangeFromJsonNode } from '../utils'
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
        const text = new TextDecoder().decode(data)

        return this.checkPackageJson(text, uri)
    }

    checkPackageJson(text: string, uri: vscode.Uri,): Finding[] {
        const json: any = jsonc.parse(text) as Record<string, unknown>

        const findings: Finding[] = []
        const scripts = json.scripts
        if (!scripts) return findings

        if (scripts.preinstall) {
            const priority = isDangerousCommand(scripts.preinstall) ? 'high' : 'medium'

            findings.push({
                type: FindingType.InstallScript,
                name: `Detected preinstall script in package.json`,
                detail: `A preinstall script was detected in package.json. Preinstall scripts are a known attack vector for supply chain attacks, as they run before any dependencies are installed and can execute arbitrary code. Review the preinstall script to ensure it is safe.`,
                priority: priority,
                file: vscode.workspace.asRelativePath(uri, false),
                range: rangeFromJsonNode(text, ['scripts', 'preinstall']),
                references: ['https://opensourcemalware.com/blog/malware-abuses-vscode-lifecycle-scripts']
            })
        }

        if (scripts.postinstall) {
            const priority = isDangerousCommand(scripts.postinstall) ? 'high' : 'medium'

            findings.push({
                type: FindingType.InstallScript,
                name: `Detected postinstall script in package.json`,
                detail: `A postinstall script was detected in package.json. Postinstall scripts run automatically after dependency installation and can execute arbitrary code. Review this script to ensure it is intentional and safe.`,
                priority: priority,
                file: vscode.workspace.asRelativePath(uri, false),
                range: rangeFromJsonNode(text, ['scripts', 'postinstall']),
                references: ['https://opensourcemalware.com/blog/malware-abuses-vscode-lifecycle-scripts']
            })
        }

        return findings
    }
}
