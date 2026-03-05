import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'

export interface TaskPresentation {
    reveal?: string        // "always" | "silent" | "never"
    echo?: boolean
    focus?: boolean
    close?: boolean
    clear?: boolean
    panel?: string
    showReuseMessage?: boolean
}

export interface Task {
    label?: string
    type?: string          // "shell" | "process"
    command?: string
    args?: (string | { value: string; quoting?: string })[]
    presentation?: TaskPresentation
    dependsOn?: string | string[]
    runOptions?: Record<string, unknown>
}

interface TasksJson {
    version?: string
    tasks?: Task[]
    presentation?: TaskPresentation
    runOptions?: Record<string, unknown>
}

/**
 * Reads and parses .vscode/tasks.json files directly from disk.
 * Using vscode APIs only works on trusted workspaces
 * This works in both trusted and untrusted workspaces.
 */
export class TaskFileReader {

    /**
     * Parse a tasks.json file and return the list of tasks with
     * presentation defaults applied.
     *
     * If `content` is provided it is used directly; otherwise the
     * file is read from disk via the given `uri`.
     */
    public async getTasks(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Task[]> {
        if (content === undefined) {
            try {
                const bytes = await vscode.workspace.fs.readFile(uri)
            } catch {
                return []
            }
        }

        const errors: jsonc.ParseError[] = []
        const raw = jsonc.parse(new TextDecoder().decode(content), errors) as TasksJson | undefined
        if (!raw?.tasks) return []

        const defaultPresentation = raw.presentation
        const tasks: Task[] = []

        for (const rawTask of raw.tasks) {
            tasks.push({
                ...rawTask,
                presentation: {
                    ...defaultPresentation,
                    ...rawTask.presentation,
                },
            })
        }

        return tasks
    }

    /**
     * Build the full command string for a task, including its args.
     */
    public static getFullCommand(task: Task): string | undefined {
        if (!task.command) return undefined

        if (!task.args?.length) return task.command

        const argsStr = task.args
            .map(a => (typeof a === 'string' ? a : a.value))
            .join(' ')

        return `${task.command} ${argsStr}`
    }
}
