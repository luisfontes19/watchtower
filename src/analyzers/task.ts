import * as vscode from 'vscode'
import { Task, TaskFileReader } from '../taskFileReader'
import { Finding, FindingType } from '../types'
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
        const taskReader = new TaskFileReader()
        const tasks = await taskReader.getTasks(uri, content) //tasks.json files can be big, so we want to avoid reading them multiple times

        const findings: Finding[] = []
        for (const task of tasks) {
            findings.push(...this.analyzeTask(task, uri))
        }

        return findings
    }

    private analyzeTask(task: Task, uri: vscode.Uri): Finding[] {
        const findings: Finding[] = []

        const taskName = task.label ?? task.command ?? 'unknown'

        if (this.isSuspiciousCommand(TaskFileReader.getFullCommand(task) ?? ''))
            findings.push({
                type: FindingType.Task,
                name: `Task '${taskName}' has a suspicious command`,
                detail: `This task executes a command commonly used in malware techniques: ${TaskFileReader.getFullCommand(task)}`,
                priority: 'high',
                file: uri.fsPath
            })

        if (this.hidingPresentationScore(task) >= 3)
            findings.push({
                type: FindingType.Task,
                name: `Task '${taskName}' tries to hide itself from the UI`,
                detail: `This task attempts defines multiple settings to try to hide itself from the user, which may indicate malicious intent. Presentation options: ${JSON.stringify(task.presentation)}`,
                priority: 'low',
                file: uri.fsPath
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
