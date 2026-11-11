import * as path from 'path'
import * as vscode from 'vscode'
import { logger } from './logger'
import { InlineFindingType, StartupScansMode } from './types'

export type DevContainerToggleSetting =
    | 'openByDefault'
    | 'onlyIfNoInitCommands'
    | 'onlyIfNoMounts'
    | 'openInUntrustedWorkspaces'
    | 'securityChecksOnlyWhenUntrusted'

export class Settings {
    private static instance: Settings
    private workspaceStorage: vscode.Memento
    private globalStorage: vscode.Memento

    private constructor(context: vscode.ExtensionContext) {
        this.workspaceStorage = context.workspaceState
        this.globalStorage = context.globalState
    }

    public static getInstance(context?: vscode.ExtensionContext): Settings {
        if (!Settings.instance) {
            if (!context) {
                throw new Error('Extension context is required for first initialization')
            }
            Settings.instance = new Settings(context)
        }
        return Settings.instance
    }


    // TODO: this may be a bit problematic, will need to be addressed eventually
    private getWorkspacePath(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return 'default'
        }
        return workspaceFolders[0].uri.fsPath
    }

    private workspaceKey(setting: string): string {
        return `${this.getWorkspacePath()}.${setting}`
    }


    public getGlobalStartupScans(): StartupScansMode {
        return vscode.workspace
            .getConfiguration('watchtower')
            .get<StartupScansMode>('startupScans', StartupScansMode.onUntrusted)
    }

    public getGlobalInlineFindings(): InlineFindingType {
        return vscode.workspace
            .getConfiguration('watchtower')
            .get<InlineFindingType>('inlineFindings', InlineFindingType.invisible)
    }

    public getAutoUninstallMalicious(): boolean {
        return vscode.workspace
            .getConfiguration('watchtower')
            .get<boolean>('autoUninstallMalicious', true)
    }

    public getCheckWorkspaceTrust(): boolean {
        return vscode.workspace
            .getConfiguration('watchtower')
            .get<boolean>('checkWorkspaceTrust', true)
    }

    private devContainerConfig(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('watchtower.devContainer')
    }

    public getDevContainerOpenByDefault(): boolean {
        return this.devContainerConfig().get<boolean>('openByDefault', false)
    }

    public getDevContainerOnlyIfNoInitCommands(): boolean {
        return this.devContainerConfig().get<boolean>('onlyIfNoInitCommands', true)
    }

    public getDevContainerOnlyIfNoMounts(): boolean {
        return this.devContainerConfig().get<boolean>('onlyIfNoMounts', true)
    }

    public getDevContainerOpenInUntrustedWorkspaces(): boolean {
        return this.devContainerConfig().get<boolean>('openInUntrustedWorkspaces', false)
    }

    public getDevContainerSecurityChecksOnlyWhenUntrusted(): boolean {
        return this.devContainerConfig().get<boolean>('securityChecksOnlyWhenUntrusted', false)
    }

    public getDevContainerRetryCooldownMinutes(): number {
        return this.devContainerConfig().get<number>('retryCooldownMinutes', 10)
    }

    private devContainerAttempts(): Record<string, number> {
        return this.globalStorage.get<Record<string, number>>('devContainerAttempts', {})
    }

    /** Minutes left before the project may be auto-opened again, or 0 if it can be opened now */
    public devContainerCooldownRemainingMinutes(projectPath: string): number {
        const cooldownMs = this.getDevContainerRetryCooldownMinutes() * 60_000
        const lastAttempt = this.devContainerAttempts()[path.resolve(projectPath)]
        if (cooldownMs <= 0 || lastAttempt === undefined) return 0
        return Math.max(0, (lastAttempt + cooldownMs - Date.now()) / 60_000)
    }

    public async recordDevContainerAttempt(projectPath: string): Promise<void> {
        const now = Date.now()
        const cooldownMs = this.getDevContainerRetryCooldownMinutes() * 60_000
        // drop expired entries so the map doesn't grow forever
        const attempts = Object.fromEntries(Object.entries(this.devContainerAttempts()).filter(([, time]) => time + cooldownMs > now))
        attempts[path.resolve(projectPath)] = now
        await this.globalStorage.update('devContainerAttempts', attempts)
    }

    public async toggleDevContainerSetting(key: DevContainerToggleSetting): Promise<void> {
        const current = this.devContainerConfig().get<boolean>(key)
        await this.devContainerConfig().update(key, !current, vscode.ConfigurationTarget.Global)
        logger.info(`Dev Container setting '${key}' set to ${!current}`)
    }

    public getDevContainerExceptions(): string[] {
        return this.devContainerConfig().get<string[]>('exceptions', [])
    }

    public isDevContainerException(projectPath: string): boolean {
        const normalize = (p: string) => path.resolve(p)
        const target = normalize(projectPath)
        return this.getDevContainerExceptions().some(p => normalize(p) === target)
    }

    public async addDevContainerException(projectPath: string): Promise<void> {
        if (this.isDevContainerException(projectPath)) return
        const updated = [...this.getDevContainerExceptions(), path.resolve(projectPath)]
        await this.devContainerConfig().update('exceptions', updated, vscode.ConfigurationTarget.Global)
        logger.info(`Added Dev Container exception for ${path.resolve(projectPath)}`)
    }

    public getDevContainerDisabledProjects(): string[] {
        return this.devContainerConfig().get<string[]>('disabledProjects', [])
    }

    public isDevContainerDisabled(projectPath: string): boolean {
        const target = path.resolve(projectPath)
        return this.getDevContainerDisabledProjects().some(p => path.resolve(p) === target)
    }

    /** Stops (or resumes) automatically opening the project in its Dev Container */
    public async setDevContainerDisabled(projectPath: string, disabled: boolean): Promise<void> {
        const target = path.resolve(projectPath)
        const others = this.getDevContainerDisabledProjects().filter(p => path.resolve(p) !== target)
        await this.devContainerConfig().update('disabledProjects', disabled ? [...others, target] : others, vscode.ConfigurationTarget.Global)
        logger.info(`Dev Container auto-open ${disabled ? 'disabled' : 'enabled'} for ${target}`)
    }

    public getExcludedFolders(): string[] {
        return vscode.workspace
            .getConfiguration('watchtower')
            .get<string[]>('excludedFolders', [])
    }

    public getDisabledRules(): string[] {
        return vscode.workspace.getConfiguration('watchtower').get<string[]>('disabledRules', [])
    }

    public async toggleRule(ruleId: string): Promise<void> {
        const disabled = this.getDisabledRules()
        const updated = disabled.includes(ruleId) ? disabled.filter(id => id !== ruleId) : [...disabled, ruleId]
        await vscode.workspace.getConfiguration('watchtower').update('disabledRules', updated, vscode.ConfigurationTarget.Global)
    }


    public async setGlobalStartupScans(mode: StartupScansMode): Promise<void> {
        await vscode.workspace.getConfiguration('watchtower').update('startupScans', mode, vscode.ConfigurationTarget.Global)
    }

    public async setGlobalInlineFindings(type: InlineFindingType): Promise<void> {
        await vscode.workspace.getConfiguration('watchtower').update('inlineFindings', type, vscode.ConfigurationTarget.Global)
    }


    public getWorkspaceStartupScan(): boolean {
        return this.workspaceStorage.get<boolean>(this.workspaceKey('runStartupScan'), true)
    }

    public async setWorkspaceStartupScan(enabled: boolean): Promise<void> {
        await this.workspaceStorage.update(this.workspaceKey('runStartupScan'), enabled)
    }

    public getWorkspaceRealTimeDetection(): boolean {
        return this.workspaceStorage.get<boolean>(this.workspaceKey('runRealTimeDetection'), true)
    }

    public async setWorkspaceRealTimeDetection(enabled: boolean): Promise<void> {
        await this.workspaceStorage.update(this.workspaceKey('runRealTimeDetection'), enabled)
    }

    public getWorkspaceDisabledRules(): string[] {
        return this.workspaceStorage.get<string[]>(this.workspaceKey('disabledRules'), [])
    }

    public async toggleWorkspaceRule(ruleId: string): Promise<void> {
        const disabled = this.getWorkspaceDisabledRules()
        const updated = disabled.includes(ruleId) ? disabled.filter(id => id !== ruleId) : [...disabled, ruleId]
        await this.workspaceStorage.update(this.workspaceKey('disabledRules'), updated)
    }

    public getWorkspaceExcludedFiles(): string[] {
        return this.workspaceStorage.get<string[]>(this.workspaceKey('excludedFiles'), [])
    }

    public async setWorkspaceExcludedFiles(patterns: string[]): Promise<void> {
        await this.workspaceStorage.update(this.workspaceKey('excludedFiles'), patterns)
    }

    public getWorkspaceExcludedFolders(): string[] {
        return this.workspaceStorage.get<string[]>(this.workspaceKey('excludedFolders'), [])
    }

    public async setWorkspaceExcludedFolders(patterns: string[]): Promise<void> {
        await this.workspaceStorage.update(this.workspaceKey('excludedFolders'), patterns)
    }

    public getAllExcludedFolders(): string[] {
        return [...this.getExcludedFolders(), ...this.getWorkspaceExcludedFolders()]
    }

    public getAllDisabledRules(): string[] {
        return [...new Set([...this.getDisabledRules(), ...this.getWorkspaceDisabledRules()])]
    }


    public hasExplicitProjectSetting(setting: string): boolean {
        return this.workspaceStorage.get(this.workspaceKey(setting)) !== undefined
    }

    public shouldRunStartupScanForWorkspace(): boolean {
        if (this.hasExplicitProjectSetting('runStartupScan')) return this.getWorkspaceStartupScan()


        const mode = this.getGlobalStartupScans()
        if (mode === StartupScansMode.off) return false
        if (mode === StartupScansMode.onUntrusted && vscode.workspace.isTrusted)
            return false

        return this.getWorkspaceStartupScan()
    }


    public shouldRunRealtimeScanForWorkspace(): boolean {
        if (this.hasExplicitProjectSetting('runRealTimeDetection'))
            return this.getWorkspaceRealTimeDetection()


        const mode = this.getGlobalStartupScans()
        if (mode === StartupScansMode.off) return false
        if (mode === StartupScansMode.onUntrusted) return false

        return this.getWorkspaceRealTimeDetection()
    }

    public getProjectState(): { startupScanDisabled: boolean; realtimeDetectionDisabled: boolean } {
        return {
            startupScanDisabled: !this.getWorkspaceStartupScan(),
            realtimeDetectionDisabled: !this.getWorkspaceRealTimeDetection()
        }
    }

    public getKnownExtensions(): string[] {
        return this.globalStorage.get<string[]>('knownExtensions', [])
    }

    public async setKnownExtensions(extensionIds: string[]): Promise<void> {
        await this.globalStorage.update('knownExtensions', extensionIds)
    }

    public getLastKnownVersion(): string | undefined {
        return this.globalStorage.get<string>('lastVersion')
    }

    public async setLastKnownVersion(version: string): Promise<void> {
        await this.globalStorage.update('lastVersion', version)
    }

}
