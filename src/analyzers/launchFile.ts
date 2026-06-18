import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { rule } from '../rules'
import { Configuration, Finding, FindingType } from '../types'
import { rangeFromJsonNode } from '../utils'
import { StaticAnalyzer } from './staticAnalyzer'

export class LaunchAnalyzer extends StaticAnalyzer {

    alertOnEditedInBackground(): boolean {
        return false
    }

    canScanFile(uri: vscode.Uri): boolean {
        return uri.fsPath.endsWith('.vscode/launch.json')
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const findings: Finding[] = []

        const data = await this.ensureFileContent(uri, content)
        const textContent = new TextDecoder().decode(data)
        const jsonContent = jsonc.parse(textContent)


        const configs = jsonContent.configurations as Configuration[] || []
        for (let i = 0; i < configs.length; i++) {
            findings.push(...this.analyzeConfiguration(configs[i], uri, textContent, i))
        }

        return findings
    }

    @rule('suspicious-launch-config', 'Detects suspicious launch configurations with custom programs or hidden configs')
    analyzeConfiguration(config: Configuration, uri: vscode.Uri, text: string, index: number): Finding[] {
        const configName = config.name ?? config.type ?? 'unknown'

        let data: any = { program: undefined, hiddenPresentation: false, score: 0 }

        if (config.program)
            data = { ...data, program: config.program, score: data.score + 1 }

        if (config.presentation?.hidden)
            data = { ...data, hiddenPresentation: true, score: data.score + 1 }

        if (!data.program && !data.hiddenPresentation)
            return []

        const issues: string[] = []
        if (data.program)
            issues.push(`🎯 Custom program: "${data.program}" — a launch configuration with a custom program entry point can execute arbitrary binaries or scripts. Verify this points to a trusted file.`)
        if (data.hiddenPresentation)
            issues.push(`👻 Hidden configuration: presentation.hidden is true, which hides this config from the debug dropdown. Attackers use this to conceal malicious debug configurations from the developer.`)

        const priority: Finding['priority'] = data.score >= 2 ? 'medium' : 'low'

        const tags: string[] = []
        if (data.program) tags.push('custom program')
        if (data.hiddenPresentation) tags.push('hidden from UI')

        return [{
            type: FindingType.Configuration,
            name: `Config '${configName}' — ${tags.join(', ')}`,
            detail: issues.join('\n'),
            priority,
            file: vscode.workspace.asRelativePath(uri),
            range: rangeFromJsonNode(text, ['configurations', index, "program"]),
            references: ['https://luisfontes19.github.io/living-of-the-code/#vscode-launch']
        }]
    }
}
