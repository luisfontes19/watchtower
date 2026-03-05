import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'

import { Finding, FindingType, Task } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'
export const SUSPICIOUS_COMMANDS = [
    /\bcurl\b/i,
    /\bwget\b/i,
    /\bInvoke-WebRequest\b/i,
    /\bpowershell\b/i,
    /\bcmd\b/i,
    /\bbash\b/i,
    /\bsh\b/i,
    /\bbase64\b/i,
    /\bcertutil\b/i,
    /\bftp\b/i,
    /\btelnet\b/i,
    /\bnetcat\b/i,
    /\bnc\b/i,
    /\bperl\b/i,
    /\bpython\b/i,
    /\bruby\b/i,
    /\bphp\b/i,
    /\bnode\b/i,
    /\bnpm\b/i,
    /\bpwsh\b/i,
]

export class TaskAnalyzer extends StaticAnalyzer {

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        if (!content)
            content = await vscode.workspace.fs.readFile(uri)

        const textContent = new TextDecoder().decode(content)
        const jsonContent = jsonc.parse(textContent) as Record<string, unknown>

        const tasks = jsonContent.tasks as Task[] || []

        const findings: Finding[] = []
        for (const task of tasks) {
            const finding = this.analyzeTask(task, uri)
            if (finding) findings.push(finding)
        }

        return findings
    }

    private analyzeTask(task: Task, uri: vscode.Uri): Finding | undefined {
        const taskName = task.label ?? task.command ?? 'unknown'

        let data: any = { command: undefined, presentation: undefined, runOnFolderOpen: false, score: 0 }

        const cmd = TaskAnalyzer.getFullCommand(task)
        if (TaskAnalyzer.isSuspiciousCommand(cmd ?? ''))
            data = { ...data, command: cmd, score: data.score + 3 }

        if (TaskAnalyzer.hidingPresentationScore(task) >= 3)
            data = { ...data, presentation: task.presentation, score: data.score + 1 }

        if (this.runsOnFolderOpen(task))
            data = { ...data, runOnFolderOpen: true, score: data.score + 1 }

        if (!data.command && !data.presentation && !data.runOnFolderOpen)
            return undefined

        const issues: string[] = []
        if (data.command)
            issues.push(`⚠️ Suspicious command: "${data.command}" — uses tools commonly abused for remote code execution or data exfiltration.`)
        if (data.presentation)
            issues.push(`👻 Hidden output: presentation is configured to suppress evidence of execution (${Object.entries(data.presentation).map(([k, v]) => `${k}: ${v}`).join(', ')}). Malicious tasks often hide their traces this way.`)
        if (data.runOnFolderOpen)
            issues.push(`🚀 Auto-run: this task executes automatically when the folder is opened — no user interaction required. Verify this is intentional.`)

        const priority: Finding['priority'] = data.score >= 3 ? 'high' : data.score === 2 ? 'medium' : 'low'

        const tags: string[] = []
        if (data.command) tags.push('suspicious command')
        if (data.presentation) tags.push('hidden output')
        if (data.runOnFolderOpen) tags.push('auto-runs on open')

        return {
            type: FindingType.Task,
            name: `Task '${taskName}' — ${tags.join(', ')}`,
            detail: issues.join('\n'),
            priority,
            file: vscode.workspace.asRelativePath(uri),
        }
    }

    private static isSuspiciousCommand(command: string): boolean {
        return SUSPICIOUS_COMMANDS.some((regex) => regex.test(command))
    }

    private runsOnFolderOpen(task: Task): boolean {
        return task.runOptions?.runOn === 'folderOpen'
    }

    private static hidingPresentationScore(task: Task): number {
        const opts = task.presentation
        let score = 0

        if (opts) {
            if (opts.clear) score += 1
            if (opts.echo === false) score += 1
            if (opts.focus === false) score += 1
            if (opts.close === true) score += 1
            if (opts.reveal && ['never', 'silent'].includes(opts.reveal)) score += 1
        }

        return score
    }

    public static getFullCommand(task: Task): string | undefined {
        if (!task.command) return undefined

        if (!task.args?.length) return task.command

        const argsStr = task.args
            .map(a => (typeof a === 'string' ? a : a.value))
            .join(' ')

        return `${task.command} ${argsStr}`
    }
}
