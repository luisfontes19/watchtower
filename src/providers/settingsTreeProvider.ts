import * as vscode from 'vscode'
import { RuleRegistry } from '../rules'
import { Settings } from '../settings'
import { InlineFindingType, StartupScansMode } from '../types'

class SettingsItem extends vscode.TreeItem {
    constructor(
        label: string,
        description: string,
        tooltip: string,
        icon: vscode.ThemeIcon,
        command: vscode.Command,
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
    private projectSettingsGroup = new ProjectSettingsGroupItem()

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
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

                this.globalSettingsGroup,
                this.projectSettingsGroup,
            ]
        }

        const settings = Settings.getInstance()

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
                this.globalRulesGroup,
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
