import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { SUSPICIOUS_COMMANDS } from '../dangerousCommands'
import { rule } from '../rules'
import { Finding, FindingType } from '../types'
import { rangeFromJsonNode, rangeOfKeyInText } from '../utils'
import { StaticAnalyzer } from './staticAnalyzer'


export class SettingsAnalyzer extends StaticAnalyzer {

    static readonly BINARY_KEYS = [
        // Used for python
        "python.defaultInterpreterPath",
        "isort.path",
        "python.pipenvPath",
        "python.poetryPath",
        "python.pixiToolPath",
        "python.testing.pytestPath",
        "python.analysis.typeServerExecutable",
        // JS/TS
        "js/ts.tsserver.node.path",
        "debug.javascript.defaultRuntimeExecutable",

        // PHP
        "php.validate.executablePath",
    ]

    static readonly TERMINAL_ENV_KEYS = [
        'terminal.integrated.env.linux',
        'terminal.integrated.env.osx',
        'terminal.integrated.env.windows',
    ]

    static readonly SENSITIVE_ENV_VARS = ['LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH', 'PYTHONPATH', 'PYTHONSTARTUP', 'NODE_PATH', 'NODE_OPTIONS', 'RUBYLIB', 'PERL5LIB']

    alertOnEditedInBackground(): boolean {
        return true
    }

    canScanFile(uri: vscode.Uri): boolean {
        return uri.fsPath.endsWith('.vscode/settings.json')
    }

    // would be nice to detect changes to:
    //      chat.tools.autoApprove
    //      *.executablePath

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const findings: Finding[] = []
        const data = content ?? await vscode.workspace.fs.readFile(uri)
        const textContent = new TextDecoder().decode(data)
        const json = jsonc.parse(textContent) as Record<string, any>

        findings.push(...this.checkBinaryPaths(json, uri, textContent))
        findings.push(...this.checkAiAgentConfiguration(json, uri, textContent))
        findings.push(...this.checkTerminalEnvOverrides(json, uri, textContent))

        return findings
    }

    @rule('custom-binary-path', 'Detects custom interpreter/binary paths in VS Code settings')
    checkBinaryPaths(json: Record<string, any>, uri: vscode.Uri, textContent: string): Finding[] {
        const findings: Finding[] = []

        const findInterpreterPaths = (obj: unknown, path: string = ''): void => {
            if (obj === null || obj === undefined || typeof obj !== 'object')
                return

            for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
                const currentPath = path ? `${path}.${key}` : key
                if (SettingsAnalyzer.BINARY_KEYS.some(k => k.toLowerCase() === currentPath.toLowerCase())) {
                    findings.push({
                        type: FindingType.Binary,
                        name: `Custom Interpreter Path defined in ${vscode.workspace.asRelativePath(uri)}`,
                        detail: `Setting "${currentPath}" points to a custom binary path: "${value}". This could be an attempt to execute malicious code.`,
                        priority: 'high',
                        file: vscode.workspace.asRelativePath(uri, false),
                        range: rangeOfKeyInText(textContent, key),
                        references: ['https://luisfontes19.github.io/living-of-the-code/#vscode-settings']
                    })
                }
                if (typeof value === 'object') {
                    findInterpreterPaths(value, currentPath)
                }
            }
        }

        findInterpreterPaths(json)
        return findings
    }

    @rule('ai-auto-approve', 'Detects insecure AI agent auto-approve configurations')
    checkAiAgentConfiguration(json: Record<string, any>, uri: vscode.Uri, text: string): Finding[] {
        const issues: string[] = []
        let score = 0

        // Check general tools auto-approve
        if (json.chat?.tools?.autoApprove === true) {
            issues.push("🚨 Global tool auto-approval enabled: All AI tool requests are automatically approved without user confirmation")
            score += 3
        }

        // Check URL auto-approval
        if (json["chat.tools.urls.autoApprove"] !== false && json["chat.tools.urls.autoApprove"] !== undefined) {
            if (json["chat.tools.urls.autoApprove"] === true) {
                issues.push("🌐 URL auto-approval enabled globally: AI agents can make network requests to any URL without user confirmation")
                score += 3
            } else {
                issues.push(`🌐 URL auto-approval configured: AI agents can make network requests to specific URLs (${JSON.stringify(json["chat.tools.urls.autoApprove"])}) without user confirmation`)
                score += 1
            }
        }

        // Check edits auto-approval
        if (json["chat.tools.edits.autoApprove"] !== undefined && json["chat.tools.edits.autoApprove"] !== false) {
            const editsAutoApprove = json["chat.tools.edits.autoApprove"]
            if (editsAutoApprove === true) {
                issues.push("✏️ File edit auto-approval enabled globally: AI agents can modify any file without user confirmation")
                score += 3
            } else if (this.containsSensitiveFilePattern(editsAutoApprove)) {
                issues.push(`✏️ File edit auto-approval for sensitive files: AI agents can modify security-critical files (${JSON.stringify(editsAutoApprove)}) without user confirmation`)
                score += 3
            } else {
                issues.push(`✏️ File edit auto-approval configured: AI agents can modify specific files (${JSON.stringify(editsAutoApprove)}) without user confirmation`)
                score += 1
            }
        }

        // Check terminal auto-approval
        if (json["chat.tools.terminal.autoApprove"] !== undefined && json["chat.tools.terminal.autoApprove"] !== false) {
            const terminalAutoApprove = json["chat.tools.terminal.autoApprove"]
            if (terminalAutoApprove === true) {
                issues.push("⚡ Terminal auto-approval enabled globally: AI agents can execute any command without user confirmation")
                score += 3
            } else if (typeof terminalAutoApprove === 'object') {
                const suspiciousCommands = Object.keys(terminalAutoApprove).filter(command =>
                    SUSPICIOUS_COMMANDS.some(regex => regex.test(command))
                )
                if (suspiciousCommands.length > 0) {
                    issues.push(`⚡ Terminal auto-approval for suspicious commands: AI agents can execute potentially dangerous commands (${suspiciousCommands.join(', ')}) without user confirmation`)
                    score += 3
                } else {
                    issues.push(`⚡ Terminal auto-approval configured: AI agents can execute specific commands (${Object.keys(terminalAutoApprove).join(', ')}) without user confirmation`)
                    score += 1
                }
            }
        }

        if (issues.length === 0)
            return []


        const priority: Finding['priority'] = score >= 3 ? 'high' : score === 2 ? 'medium' : 'low'

        // Point to the first matching AI config key
        const aiKeys = ['chat.tools.autoApprove', 'chat.tools.urls.autoApprove', 'chat.tools.edits.autoApprove', 'chat.tools.terminal.autoApprove']
        let range: vscode.Range | undefined
        for (const k of aiKeys) {
            range = rangeOfKeyInText(text, k)
            if (range) break
        }

        return [{
            type: FindingType.AutoApprove,
            name: "Insecure AI agent configurations can lead to compromises",
            detail: issues.join('\n'),
            priority,
            file: vscode.workspace.asRelativePath(uri, false),
            range
        }]
    }

    @rule('terminal-env-override', 'Detects terminal environment variable overrides that could hijack binaries')
    checkTerminalEnvOverrides(json: Record<string, any>, uri: vscode.Uri, text: string): Finding[] {
        const findings: Finding[] = []
        const file = vscode.workspace.asRelativePath(uri, false)

        for (const key of SettingsAnalyzer.TERMINAL_ENV_KEYS) {
            const envVars = json[key]
            if (!envVars || typeof envVars !== 'object') continue

            for (const [varName, value] of Object.entries(envVars as Record<string, string>)) {
                const upperVar = varName.toUpperCase()
                const range = rangeFromJsonNode(text, [key, varName])

                if (upperVar === 'PATH' || SettingsAnalyzer.SENSITIVE_ENV_VARS.includes(upperVar)) {
                    findings.push({
                        type: FindingType.Binary,
                        name: `Terminal environment variable '${varName}' overridden in .vscode/settings.json`,
                        detail: `\`${key}\` sets \`${varName}=${value}\`. Overriding this variable can be used to hijack binaries, inject libraries, or redirect module resolution to attacker-controlled code.`,
                        priority: 'high',
                        file,
                        range
                    })
                }
            }
        }

        return findings
    }

    private containsSensitiveFilePattern(autoApprove: any): boolean {
        if (typeof autoApprove !== 'object' || autoApprove === null) {
            return false
        }

        const sensitiveFilePatterns = [
            '.vscode/settings.json',
            '.devcontainer/devcontainer.json',
            '.vscode/tasks.json',
            '.vscode/launch.json',
            '**/.vscode/**',
            '**/devcontainer.json',
            '**/*.json',
            '**/*.md'
        ]

        for (const pattern of Object.keys(autoApprove)) {
            if (sensitiveFilePatterns.some(sensitive =>
                pattern.includes(sensitive) ||
                pattern === '**/*' ||
                pattern === '*' ||
                sensitive.includes(pattern)
            )) {
                return true
            }
        }

        return false
    }
}
