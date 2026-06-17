import * as vscode from 'vscode'
import { rule } from '../rules'
import { Finding, FindingType } from '../types'
import { rangeFromOffset } from '../utils'
import { StaticAnalyzer } from './staticAnalyzer'

interface Indicator {
    label: string
    regex: RegExp
    why: string
    highRisk: boolean
}

const REFERENCES = ['https://luisfontes19.github.io/living-of-the-code/#node-gyp', 'https://www.aikido.dev/blog/exploring-binding-gyp-npm-build-system']

const INDICATORS: Indicator[] = [
    {
        label: 'GYP command expansion token',
        regex: /(?:<|>|\^)!@?\([^\n)]*\)|<!pymod_do_main\s*\(/g,
        why: 'Runs shell commands or Python module entry points while GYP parses the file, before compilation starts.',
        highRisk: true,
    },
    {
        label: 'Build action/rule/postbuild command block',
        regex: /["'](?:actions|rules|postbuilds)["']\s*:/g,
        why: 'These blocks are explicitly designed to run commands during build steps.',
        highRisk: true,
    },
    {
        label: 'Compiler/toolchain override',
        regex: /["'](?:make_global_settings|CC|CXX|LINK|AR|CC_wrapper|CFLAGS|LDFLAGS)["']\s*:/g,
        why: 'Can hijack compiler/linker execution or inject evaluated build-time flags.',
        highRisk: true,
    },
    {
        label: 'Cross-file execution surface',
        regex: /["'](?:includes|dependencies)["']\s*:/g,
        why: 'Can load additional GYP files transitively where malicious logic may be hidden.',
        highRisk: false,
    },
    {
        label: 'Python sandbox-escape marker',
        regex: /__subclasses__|catch_warnings|__builtins__|__import__|\.system\s*\(/g,
        why: 'Strong signal of Python eval sandbox-escape attempts in GYP parsing.',
        highRisk: true,
    },
]

export class BindingGypAnalyzer extends StaticAnalyzer {

    alertOnEditedInBackground(): boolean {
        return false
    }

    canScanFile(uri: vscode.Uri): boolean {
        const normalized = uri.fsPath.replace(/\\/g, '/')
        return normalized.endsWith('/binding.gyp') || normalized.endsWith('/bindings.gyp')
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const data = await this.ensureFileContent(uri, content)
        const text = new TextDecoder().decode(data)
        return this.detectBindingGypRisk(text, uri)
    }

    @rule('binding-gyp', 'Detects binding.gyp install-time execution surfaces and suspicious patterns')
    detectBindingGypRisk(text: string, uri: vscode.Uri): Finding[] {
        const file = vscode.workspace.asRelativePath(uri, false)
        const indicators = this.collectIndicators(text)

        // If no indicators but the file is present, we still want to flag it as an install-time execution surface worth manual review
        if (indicators.length === 0) {
            return [{
                type: FindingType.BindingGyp,
                name: 'binding.gyp detected (install-time execution surface)',
                detail: [
                    'npm can trigger node-gyp automatically when a package contains binding.gyp, even without lifecycle scripts in package.json.',
                    'No specific high-risk indicator was matched in this file, but the file itself is still an install-time execution surface.',
                    'What to inspect: any command expansions (<!(...), <!@(...), <!pymod_do_main), action/rule/postbuild command arrays, compiler overrides, includes/dependencies chains, and Python-eval-style expressions.',
                ].join('\n\n'),
                priority: 'medium',
                file,
                references: REFERENCES
            }]
        }

        return indicators.map(indicator => ({
            type: FindingType.BindingGyp,
            name: `binding.gyp indicator: ${indicator.label}`,
            detail: [
                'npm can trigger node-gyp automatically when a package contains binding.gyp, even without lifecycle scripts in package.json.',
                `Matched pattern: "${indicator.preview}"`,
                `Why this matters: ${indicator.why}`,
                'What to inspect: follow the command or referenced file, and verify it cannot execute untrusted code during install/build.',
            ].join('\n\n'),
            priority: indicator.highRisk ? 'high' : 'medium',
            file,
            range: rangeFromOffset(text, indicator.start, indicator.end),
            references: REFERENCES
        }))
    }

    private collectIndicators(text: string): Array<Indicator & { start: number, end: number, preview: string }> {
        const found: Array<Indicator & { start: number, end: number, preview: string }> = []

        for (const indicator of INDICATORS) {
            const matches = text.matchAll(indicator.regex)
            for (const match of matches) {
                if (match.index === undefined) continue
                const preview = match[0].trim().replace(/\s+/g, ' ').slice(0, 140)
                found.push({
                    ...indicator,
                    start: match.index,
                    end: match.index + match[0].length,
                    preview,
                })
            }
        }

        return found
    }
}
