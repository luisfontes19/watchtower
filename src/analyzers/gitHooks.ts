import * as vscode from 'vscode'
import { rule } from '../rules'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

const REFERENCES = ['https://luisfontes19.github.io/living-of-the-code/#git-hooks', 'https://opensourcemalware.com/blog/dprk-git-hooks-malware/']

export class GitHooksAnalyzer extends StaticAnalyzer {

    alertOnEditedInBackground(): boolean {
        return true
    }

    canScanFile(uri: vscode.Uri): boolean {
        return GitHooksAnalyzer.isHuskyHook(uri) || GitHooksAnalyzer.isGitHooksFolderHook(uri)
    }

    async checkFile(uri: vscode.Uri, _content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        return this.detectGitHooks(uri)
    }

    @rule('git-hooks', 'Detects git hooks folders that execute commands on git events')
    detectGitHooks(uri: vscode.Uri): Finding[] {
        const folder = this.parentFolderRelativePath(uri) + '/'

        if (GitHooksAnalyzer.isHuskyHook(uri)) {
            return [{
                type: FindingType.GitHook,
                name: `Husky git hooks folder detected: ${folder}`,
                detail: `The \`.husky\` folder contains git hooks managed by Husky. These scripts run automatically on git events such as commit, checkout, push, or merge, and execute arbitrary shell commands. A malicious or compromised hook can run code on your machine without any explicit user action. Carefully review every hook in this folder to make sure its contents are legitimate and expected.`,
                priority: 'medium',
                file: folder,
                references: REFERENCES

            }]
        }

        if (GitHooksAnalyzer.isGitHooksFolderHook(uri)) {
            return [{
                type: FindingType.GitHook,
                name: `Git hooks folder detected: ${folder}`,
                detail: `The \`.githooks\` folder contains git hooks that run automatically on git events such as commit, checkout, push, or merge. These scripts execute arbitrary shell commands and can run code on your machine without any explicit user action when a project configures \`core.hooksPath\` to point at this folder. Carefully review every hook in this folder to make sure its contents are legitimate and expected.`,
                priority: 'medium',
                file: folder,
                references: REFERENCES
            }]
        }

        return []
    }

    static isHuskyHook(uri: vscode.Uri): boolean {
        const normalized = uri.fsPath.replace(/\\/g, '/')
        if (!normalized.includes('/.husky/')) return false
        // Skip husky's internal `_` folder, which contains generated runtime files, not user hooks
        if (normalized.includes('/.husky/_/')) return false
        return true
    }

    static isGitHooksFolderHook(uri: vscode.Uri): boolean {
        const normalized = uri.fsPath.replace(/\\/g, '/')
        return normalized.includes('/.githooks/')
    }
}
