import * as path from 'path'
import * as vscode from 'vscode'
import { Finding } from '../types'
import { fileMatchesPatterns } from '../utils'
import { StaticAnalyzer } from './staticAnalyzer'

export class AgentsAnalyzer extends StaticAnalyzer {
    static AGENTS_FILE_NAMES = AgentsAnalyzer.generateAgentFilesList()


    constructor() {
        super()
        const chatSettings = vscode.workspace.getConfiguration('chat')
    }


    alertOnEditedInBackground(): boolean {
        return true
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        // we are not checking anything inside the file for now
        return []
    }

    canScanFile(uri: vscode.Uri): boolean {
        const path = uri.fsPath
        return path.endsWith('.md') && AgentsAnalyzer.isAgentFile(uri)
    }

    static isAgentFile(uri: vscode.Uri): boolean {
        return fileMatchesPatterns(uri, AgentsAnalyzer.AGENTS_FILE_NAMES)

    }

    static generateAgentFilesList(): string[] {
        const chatSettings = vscode.workspace.getConfiguration('chat')
        const agentRelatedFiles = [
            ".agents/**/*md",
            ".claude/rules/**/*.md",
            ".claude/skills/**/*.md",
            ".claude/commands/**/*.md",
            ".claude/agents/**/*.md",
            ".mcp.json",
            "mcp.json",
            "**/CLAUDE.md",
            ".github/copilot-instructions.md",
            ".github/instructions/*.instructions.md",
            "**/AGENTS.md"
        ]


        // github copilot requires agent files to end in *.agent.md
        Object.entries(chatSettings.get<Record<string, boolean>>("agentFilesLocations") || {})
            .filter(([file, enabled]) => enabled && !file.startsWith("~")) // Enabled settings only and we will be ignoring user home directory paths for now
            .map(([p]) => agentRelatedFiles.push(path.join(p, "*.agent.md")))


        // github copilot requires instruction files to end in *.instructions.md
        Object.entries(chatSettings.get<Record<string, boolean>>("instructionsFilesLocations") || {})
            .filter(([file, enabled]) => enabled && !file.startsWith("~")) // Enabled settings only and we will be ignoring user home directory paths for now
            .map(([p]) => agentRelatedFiles.push(path.join(p, "*.instructions.md")))


        Object.entries(chatSettings.get<Record<string, boolean>>('hookFilesLocations') || {})
            .filter(([file, enabled]) => enabled && !file.startsWith("~"))
            .map(([path]) => {
                // TODO: Improve this file check validation :(
                if (path.includes(".") && !path.endsWith("/"))
                    agentRelatedFiles.push(path)
                else {
                    const acceptedFileNames = ["*.json", "settings.json", "settings.local.json"]
                    acceptedFileNames.forEach(fileName => agentRelatedFiles.push(path + "/" + fileName))
                }

            })

        Object.entries(chatSettings.get<Record<string, boolean>>('agentSkillsLocations') || {})
            .filter(([file, enabled]) => enabled && !file.startsWith("~"))
            .map(([p]) => agentRelatedFiles.push(path.join(p, "**/SKILL.md")))

        console.log(agentRelatedFiles)

        return agentRelatedFiles
    }


}
