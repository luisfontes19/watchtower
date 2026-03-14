import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { Configuration, Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

export class LaunchAnalyzer extends StaticAnalyzer {

    alertOnBackgroundEdited(): boolean {
        return true
    }

    canScanFile(uri: vscode.Uri): boolean {
        return uri.fsPath.endsWith('.vscode/launch.json')
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const findings: Finding[] = []

        if (!content)
            content = await vscode.workspace.fs.readFile(uri)

        const textContent = new TextDecoder().decode(content)
        const jsonContent = jsonc.parse(textContent)


        for (const config of jsonContent.configurations as Configuration[] || []) {
            const finding = this.analyzeConfiguration(config, uri)
            if (finding) findings.push(finding)
        }

        return findings
    }

    private analyzeConfiguration(config: Configuration, uri: vscode.Uri): Finding | undefined {
        const configName = config.name ?? config.type ?? 'unknown'

        let data: any = { program: undefined, hiddenPresentation: false, score: 0 }

        if (config.program)
            data = { ...data, program: config.program, score: data.score + 1 }

        if (config.presentation?.hidden)
            data = { ...data, hiddenPresentation: true, score: data.score + 1 }

        if (!data.program && !data.hiddenPresentation)
            return undefined

        const issues: string[] = []
        if (data.program)
            issues.push(`🎯 Custom program: "${data.program}" — a launch configuration with a custom program entry point can execute arbitrary binaries or scripts. Verify this points to a trusted file.`)
        if (data.hiddenPresentation)
            issues.push(`👻 Hidden configuration: presentation.hidden is true, which hides this config from the debug dropdown. Attackers use this to conceal malicious debug configurations from the developer.`)

        const priority: Finding['priority'] = data.score >= 2 ? 'medium' : 'low'

        const tags: string[] = []
        if (data.program) tags.push('custom program')
        if (data.hiddenPresentation) tags.push('hidden from UI')

        return {
            type: FindingType.Configuration,
            name: `Config '${configName}' — ${tags.join(', ')}`,
            detail: issues.join('\n'),
            priority,
            file: vscode.workspace.asRelativePath(uri),
        }
    }
}
