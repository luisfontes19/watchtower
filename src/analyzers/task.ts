import { Task, TaskFileReader } from '../taskFileReader'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer, TaskAnalyzerParams } from './types'

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

export class TaskAnalyzer {

    public static async analyze(params?: TaskAnalyzerParams): Promise<Finding[]> {
        const taskFileReader = new TaskFileReader()
        const tasks = await taskFileReader.getTasks()

        const findings: Finding[] = []

        for (const task of tasks) {
            findings.push(...TaskAnalyzer.analyzeTask(task))
        }

        return findings
    }


    private static analyzeTask(task: Task): Finding[] {
        const findings: Finding[] = []

        if (TaskAnalyzer.isSuspiciousCommand(TaskFileReader.getFullCommand(task) ?? ''))
            findings.push({
                type: FindingType.Task,
                name: task.label ?? task.command ?? 'unknown',
                detail: `Task executes potentially dangerous command: ${TaskFileReader.getFullCommand(task)}`,
                severity: 'high',
                file: ".vscode/tasks.json"
            })

        if (TaskAnalyzer.hidingPresentationScore(task) >= 3)
            findings.push({
                type: FindingType.Task,
                name: task.label ?? task.command ?? 'unknown',
                detail: `Task tries to hide any presentation options (Low confidence finding)`,
                severity: 'medium',
                file: ".vscode/tasks.json"
            })

        return findings
    }

    private static isSuspiciousCommand(command: string): boolean {
        return SUSPICIOUS_COMMANDS.some((regex) => regex.test(command))
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
}

const _checkStatic: StaticAnalyzer = TaskAnalyzer
