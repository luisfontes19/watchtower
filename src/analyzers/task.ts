import * as vscode from 'vscode'
import { Task, TaskFileReader } from '../taskFileReader'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './types'

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

    async analyze(): Promise<Finding[]> {
        const taskFileReader = new TaskFileReader()
        const tasks = await taskFileReader.getTasks()

        const findings: Finding[] = []

        for (const task of tasks) {
            findings.push(...this.analyzeTask(task))
        }

        return findings
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        return []
    }

    async onChange(uri: vscode.Uri): Promise<Finding[]> {
        return []
    }

    private analyzeTask(task: Task): Finding[] {
        const findings: Finding[] = []

        if (this.isSuspiciousCommand(TaskFileReader.getFullCommand(task) ?? ''))
            findings.push({
                type: FindingType.Task,
                name: task.label ?? task.command ?? 'unknown',
                detail: `Task executes potentially dangerous command: ${TaskFileReader.getFullCommand(task)}`,
                severity: 'high',
                file: ".vscode/tasks.json"
            })

        if (this.hidingPresentationScore(task) >= 3)
            findings.push({
                type: FindingType.Task,
                name: task.label ?? task.command ?? 'unknown',
                detail: `Task tries to hide any presentation options (Low confidence finding)`,
                severity: 'medium',
                file: ".vscode/tasks.json"
            })

        return findings
    }

    private isSuspiciousCommand(command: string): boolean {
        return SUSPICIOUS_COMMANDS.some((regex) => regex.test(command))
    }

    private hidingPresentationScore(task: Task): number {
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
}
