import * as vscode from 'vscode'
import { getDevContainerStatus } from '../devContainerLauncher'
import { RuleRegistry } from '../rules'
import { DevContainerToggleSetting, Settings } from '../settings'
import { InlineFindingType, StartupScansMode } from '../types'

class SettingsItem extends vscode.TreeItem {
    constructor(
        label: string,
        description: string,
        tooltip: string,
        icon: vscode.ThemeIcon,
        command?: vscode.Command,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    ) {
        super(label, collapsibleState)
        this.description = description
        this.tooltip = tooltip
        this.iconPath = icon
        this.command = command
    }
}

class RulesGroupItem extends vscode.TreeItem {
    constructor(label: string, tooltip: string) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed)
        this.tooltip = tooltip
        this.iconPath = new vscode.ThemeIcon('checklist')
    }
}

class GlobalSettingsGroupItem extends vscode.TreeItem {
    constructor() {
        super('Global Settings', vscode.TreeItemCollapsibleState.Collapsed)
        this.iconPath = new vscode.ThemeIcon('globe')
    }
}

class DevContainerGroupItem extends vscode.TreeItem {
    constructor() {
        super('Dev Container', vscode.TreeItemCollapsibleState.Collapsed)
        this.tooltip = 'Control automatic opening of projects in their Dev Container'
        this.iconPath = new vscode.ThemeIcon('remote')
    }
}

class ProjectDevContainerGroupItem extends vscode.TreeItem {
    constructor(blocked: boolean) {
        super('Dev Container (This Project)', vscode.TreeItemCollapsibleState.Expanded)
        this.id = 'watchtower.projectDevContainer'
        this.description = blocked ? 'Not opened automatically' : ''
        this.tooltip = 'This project has a Dev Container configuration'
        this.iconPath = blocked
            ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'))
            : new vscode.ThemeIcon('remote')
    }
}

class ProjectSettingsGroupItem extends vscode.TreeItem {
    constructor() {
        super('Project Settings', vscode.TreeItemCollapsibleState.Collapsed)
        this.iconPath = new vscode.ThemeIcon('root-folder')
    }
}

export class SettingsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    public static readonly viewType = 'watchtower.settings'

    private _onDidChangeTreeData = new vscode.EventEmitter<void>()
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event

    refresh() {
        this._onDidChangeTreeData.fire()
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element
    }

    private globalRulesGroup = new RulesGroupItem('Rules', 'Toggle individual security rules on or off')
    private projectRulesGroup = new RulesGroupItem('Rules', 'Toggle individual security rules on or off for this project')
    private globalSettingsGroup = new GlobalSettingsGroupItem()
    private devContainerGroup = new DevContainerGroupItem()
    private projectSettingsGroup = new ProjectSettingsGroupItem()

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        const devContainer = getDevContainerStatus()
        if (!element) {
            return [
                new SettingsItem(
                    'Scan Workspace (Now)',
                    '',
                    'Run a full security scan on the current workspace',
                    new vscode.ThemeIcon('search'),
                    { command: 'watchtower.scan', title: 'Scan Workspace' },
                ),
                new SettingsItem(
                    'Scan Extension',
                    '',
                    'Check if a VS Code extension has been flagged as malicious',
                    new vscode.ThemeIcon('extensions'),
                    { command: 'watchtower.scanExtension', title: 'Scan Extension for Malware' },
                ),
                new SettingsItem(
                    'View Report',
                    '',
                    'View the full findings report',
                    new vscode.ThemeIcon('open-preview'),
                    { command: 'watchtower.showReport', title: 'View Report' },
                ),

                ...(devContainer.available ? [new ProjectDevContainerGroupItem(devContainer.blockedReasons.length > 0)] : []),
                this.globalSettingsGroup,
                this.projectSettingsGroup,
            ]
        }

        const settings = Settings.getInstance()

        if (element instanceof ProjectDevContainerGroupItem) {
            const projectPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            const autoOpen = projectPath ? !settings.isDevContainerDisabled(projectPath) : true
            const reasons = devContainer.blockedReasons

            return [
                new SettingsItem(
                    'Open in Container',
                    '',
                    'Reopen this project in its Dev Container now',
                    new vscode.ThemeIcon('remote'),
                    { command: 'watchtower.openInDevContainer', title: 'Open in Dev Container' },
                ),
                new SettingsItem(
                    'Auto-open this project',
                    enabledLabel(autoOpen),
                    `Open this project in its Dev Container automatically on startup (when allowed by the Dev Container settings)\nClick to ${autoOpen ? 'disable' : 'enable'} for this project`,
                    enabledIcon('rocket', autoOpen),
                    { command: 'watchtower.toggleDevContainerAutoOpenForProject', title: 'Toggle Dev Container Auto-open for this Project' },
                ),
                ...reasons.map(reason => new SettingsItem(
                    reason,
                    '',
                    `Watchtower did not open this project in its Dev Container automatically because:\n${reason}\n\nUse "Open in Container" if you trust this project.`,
                    new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground')),
                )),
            ]
        }

        if (element === this.globalSettingsGroup) {
            const startupScans = settings.getGlobalStartupScans()
            const inlineFindings = settings.getGlobalInlineFindings()

            return [
                new SettingsItem(
                    'Auto Uninstall Extensions',
                    enabledLabel(settings.getAutoUninstallMalicious()),
                    'Click to toggle automatic uninstall of malicious extensions',
                    enabledIcon('extensions', settings.getAutoUninstallMalicious()),
                    { command: 'watchtower.toggleAutoUninstallMalicious', title: 'Toggle Auto Uninstall' },
                ),
                new SettingsItem(
                    'Disabled Rules',
                    excludedPatternsLabel(settings.getDisabledRules()),
                    'Click to open disabled rules setting',
                    new vscode.ThemeIcon('list-filter'),
                    { command: 'workbench.action.openSettings', title: 'Open Setting', arguments: ['watchtower.disabledRules'] },
                ),
                new SettingsItem(
                    'Excluded Folders',
                    excludedPatternsLabel(settings.getExcludedFolders()),
                    'Click to open excluded folders setting',
                    new vscode.ThemeIcon('folder'),
                    { command: 'workbench.action.openSettings', title: 'Open Setting', arguments: ['watchtower.excludedFolders'] },
                ),
                new SettingsItem(
                    'Inline Findings',
                    inlineFindingsLabel(inlineFindings),
                    'Click to cycle: All → Invisible Only → None',
                    new vscode.ThemeIcon('eye', inlineFindingsColor(inlineFindings)),
                    { command: 'watchtower.cycleInlineFindings', title: 'Cycle Inline Findings' },
                ),
                new SettingsItem(
                    'Show Overview',
                    '',
                    'Click to open show overview setting',
                    new vscode.ThemeIcon('layout'),
                    { command: 'workbench.action.openSettings', title: 'Open Setting', arguments: ['watchtower.showOverview'] },
                ),
                new SettingsItem(
                    'Startup Scans',
                    startupScansLabel(startupScans),
                    'Click to cycle: On Every Project → On Untrusted → Off',
                    new vscode.ThemeIcon('rocket', startupScansColor(startupScans)),
                    { command: 'watchtower.cycleStartupScans', title: 'Cycle Startup Scans' },
                ),
                this.devContainerGroup,
                this.globalRulesGroup,
            ]
        }

        if (element === this.devContainerGroup) {
            const toggle = (label: string, key: DevContainerToggleSetting, enabled: boolean, tooltip: string, icon: string) => new SettingsItem(
                label,
                enabledLabel(enabled),
                `${tooltip}\nClick to ${enabled ? 'disable' : 'enable'}`,
                enabledIcon(icon, enabled),
                { command: 'watchtower.toggleDevContainerSetting', title: 'Toggle Dev Container Setting', arguments: [key] },
            )

            return [
                toggle('Open by Default', 'openByDefault', settings.getDevContainerOpenByDefault(),
                    'Automatically reopen projects in their Dev Container on startup', 'remote'),
                toggle('Only If No Init Commands', 'onlyIfNoInitCommands', settings.getDevContainerOnlyIfNoInitCommands(),
                    "Don't open if the config runs commands on the host (initializeCommand) or elevates privileges (runArgs, compose options)", 'terminal'),
                toggle('Only If No Mounts', 'onlyIfNoMounts', settings.getDevContainerOnlyIfNoMounts(),
                    "Don't open if the config bind mounts host paths", 'file-symlink-directory'),
                toggle('Open In Untrusted Workspaces', 'openInUntrustedWorkspaces', settings.getDevContainerOpenInUntrustedWorkspaces(),
                    'Allow opening automatically when the workspace is not trusted', 'workspace-untrusted'),
                toggle('Checks Only When Untrusted', 'securityChecksOnlyWhenUntrusted', settings.getDevContainerSecurityChecksOnlyWhenUntrusted(),
                    'Only apply the security checks to untrusted workspaces', 'shield'),
                new SettingsItem(
                    'Exceptions',
                    excludedPatternsLabel(settings.getDevContainerExceptions()),
                    'Projects that always open automatically. Click to open the setting',
                    new vscode.ThemeIcon('list-unordered'),
                    { command: 'workbench.action.openSettings', title: 'Open Setting', arguments: ['watchtower.devContainer.exceptions'] },
                ),
            ]
        }

        if (element === this.projectSettingsGroup) {
            const workspaceStartup = settings.getWorkspaceStartupScan()
            const workspaceRealTime = settings.getWorkspaceRealTimeDetection()

            return [
                new SettingsItem(
                    'Excluded Files',
                    excludedPatternsLabel(settings.getWorkspaceExcludedFiles()),
                    'Click to edit file exclusion patterns for this project',
                    new vscode.ThemeIcon('exclude'),
                    { command: 'watchtower.editWorkspaceExcludedFiles', title: 'Edit Excluded Files' },
                ),
                new SettingsItem(
                    'Excluded Folders',
                    excludedPatternsLabel(settings.getWorkspaceExcludedFolders()),
                    'Click to edit folder exclusion patterns for this project',
                    new vscode.ThemeIcon('folder'),
                    { command: 'watchtower.editWorkspaceExcludedFolders', title: 'Edit Excluded Folders' },
                ),
                new SettingsItem(
                    'Real-Time Detection',
                    enabledLabel(workspaceRealTime),
                    'Click to toggle',
                    enabledIcon('broadcast', workspaceRealTime),
                    { command: 'watchtower.toggleWorkspaceRealTime', title: 'Toggle Real-Time Detection' },
                ),
                new SettingsItem(
                    'Run on Startup',
                    enabledLabel(workspaceStartup),
                    'Click to toggle',
                    enabledIcon('play-circle', workspaceStartup),
                    { command: 'watchtower.toggleWorkspaceStartupScan', title: 'Toggle Startup Scan' },
                ),
                this.projectRulesGroup,
            ]
        }

        if (element === this.globalRulesGroup) {
            const disabledRules = settings.getDisabledRules()
            return RuleRegistry.getAllRules().map(rule => {
                const enabled = !disabledRules.includes(rule.id)
                return new SettingsItem(
                    rule.id,
                    enabledLabel(enabled),
                    `${rule.description}\nClick to ${enabled ? 'disable' : 'enable'}`,
                    enabledIcon('shield', enabled),
                    { command: 'watchtower.toggleRule', title: 'Toggle Rule', arguments: [rule.id] },
                )
            })
        }

        if (element === this.projectRulesGroup) {
            const disabledRules = settings.getWorkspaceDisabledRules()
            return RuleRegistry.getAllRules().map(rule => {
                const enabled = !disabledRules.includes(rule.id)
                return new SettingsItem(
                    rule.id,
                    enabledLabel(enabled),
                    `${rule.description}\nClick to ${enabled ? 'disable' : 'enable'} for this project`,
                    enabledIcon('shield', enabled),
                    { command: 'watchtower.toggleWorkspaceRule', title: 'Toggle Project Rule', arguments: [rule.id] },
                )
            })
        }

        return []
    }
}

function startupScansLabel(mode: StartupScansMode): string {
    switch (mode) {
        case StartupScansMode.onEveryProject: return 'On Every Project'
        case StartupScansMode.onUntrusted: return 'On Untrusted'
        case StartupScansMode.off: return 'Off'
    }
}

function inlineFindingsLabel(type: InlineFindingType): string {
    switch (type) {
        case InlineFindingType.all: return 'All'
        case InlineFindingType.invisible: return 'Invisible Only'
        case InlineFindingType.none: return 'None'
    }
}

function enabledLabel(enabled: boolean): string {
    return enabled ? 'Enabled' : 'Disabled'
}

function excludedPatternsLabel(patterns: string[]): string {
    if (patterns.length === 0) return 'None'
    return patterns.join(', ')
}

function enabledIcon(iconId: string, enabled: boolean): vscode.ThemeIcon {
    return enabled
        ? new vscode.ThemeIcon(iconId, new vscode.ThemeColor('testing.iconPassed'))
        : new vscode.ThemeIcon(iconId, new vscode.ThemeColor('testing.iconFailed'))
}

function startupScansColor(mode: StartupScansMode): vscode.ThemeColor {
    switch (mode) {
        case StartupScansMode.onEveryProject: return new vscode.ThemeColor('testing.iconPassed')
        case StartupScansMode.onUntrusted: return new vscode.ThemeColor('editorWarning.foreground')
        case StartupScansMode.off: return new vscode.ThemeColor('testing.iconFailed')
    }
}

function inlineFindingsColor(type: InlineFindingType): vscode.ThemeColor {
    switch (type) {
        case InlineFindingType.all: return new vscode.ThemeColor('testing.iconPassed')
        case InlineFindingType.invisible: return new vscode.ThemeColor('editorWarning.foreground')
        case InlineFindingType.none: return new vscode.ThemeColor('testing.iconFailed')
    }
}
