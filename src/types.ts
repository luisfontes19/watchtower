import * as vscode from 'vscode'
export enum FindingType {
    Task = "Suspicious Task",
    Configuration = "Suspicious Configuration",
    JsonSchema = "Suspicious JSON Schema",
    SilentFileChange = "Silent File Change",
    McpServer = "MCP Server",
    BinaryChange = "Binary Change",
    InvisibleCode = "Invisible Code",
    AutoApprove = "AI Auto-Approve",
    PreinstallScript = "Preinstall Script"
}

export interface Finding {
    type: FindingType,
    file: string,
    name: string,
    detail: string,
    priority: 'low' | 'medium' | 'high',
    range?: vscode.Range
}

export enum InlineFindingType {
    all = "all",
    invisible = "invisible",
    none = "none"
}

export enum StartupScansMode {
    onEveryProject = "OnEveryProject",
    onUntrusted = "OnUntrusted",
    off = "Off"
}

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

export interface Configuration {
    type: string
    request: string
    name?: string
    skipFiles?: string[]
    program?: string
    preLaunchTask?: string
    postDebugTask?: string
    args?: string[]
    cwd?: string
    presentation?: {
        hidden?: boolean
        group?: string
        order?: number
    }
}
