import * as vscode from 'vscode'
import { FindingsOverviewProvider } from './providers/findingsOverviewProvider'
import { FindingsTreeProvider } from './providers/findingsTreeProvider'
import { SettingsTreeProvider } from './providers/settingsTreeProvider'
import { exportToJSON, showHTMLReport } from './report'
import { Settings } from './settings'
import { Watchtower } from './watchtower'



export function activate(context: vscode.ExtensionContext) {
	console.log("Watchtower Extension Loading")

	const settings = Settings.getInstance(context)

	const findingsTree = new FindingsTreeProvider()
	const findingsOverview = new FindingsOverviewProvider()
	const settingsTree = new SettingsTreeProvider()
	const settingsTreeView = vscode.window.createTreeView(SettingsTreeProvider.viewType, { treeDataProvider: settingsTree })

	const watchtower = Watchtower.getInstance(findingsTree, findingsOverview, settingsTree, settingsTreeView)


	/////////////////////////////
	// Views
	/////////////////////////////

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(FindingsTreeProvider.viewType, findingsTree)
	)
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(FindingsOverviewProvider.viewType, findingsOverview)
	)
	context.subscriptions.push(settingsTreeView)
	/////////////////////////////
	// Commands
	/////////////////////////////
	const commands = [
		vscode.commands.registerCommand('watchtower.scan', watchtower.commandRunScan.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.cycleStartupScans', watchtower.commandCycleStartupScans.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.cycleInlineFindings', watchtower.commandCycleInlineFindings.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.toggleWorkspaceStartupScan', watchtower.commandToggleWorkspaceStartupScan.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.toggleWorkspaceRealTime', watchtower.commandToggleWorkspaceRealTime.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.exportToJSON', () => exportToJSON(watchtower.findings, false)),
		vscode.commands.registerCommand('watchtower.showReport', () => showHTMLReport(watchtower.findings, context.extensionUri)),
		vscode.commands.registerCommand('watchtower.revealFinding', (finding) => findingsTree.revealFinding(finding)),
		vscode.commands.registerCommand('watchtower.scanExtension', watchtower.commandScanExtension.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.toggleRule', (ruleId: string) => watchtower.commandToggleRule(ruleId)),
		vscode.commands.registerCommand('watchtower.toggleWorkspaceRule', (ruleId: string) => watchtower.commandToggleWorkspaceRule(ruleId)),
		vscode.commands.registerCommand('watchtower.editWorkspaceExcludedFiles', watchtower.commandEditWorkspaceExcludedFiles.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.editWorkspaceExcludedFolders', watchtower.commandEditWorkspaceExcludedFolders.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.toggleAutoUninstallMalicious', watchtower.commandToggleAutoUninstallMalicious.bind(watchtower)),
	]

	commands.forEach(command => context.subscriptions.push(command))
	console.log(vscode.workspace.getConfiguration('security.workspace.trust'))

	/////////////////////////////
	// Real-time listeners
	/////////////////////////////
	const watcher = vscode.workspace.createFileSystemWatcher('**/*')


	const realTimeListeners = [
		vscode.workspace.onDidOpenTextDocument(watchtower.onFileOpened.bind(watchtower)),
		vscode.window.onDidChangeActiveTextEditor(watchtower.onActiveEditorChanged.bind(watchtower)),
		watcher.onDidCreate((uri) => watchtower.onFileCreated(uri)),
		watcher.onDidChange((uri) => watchtower.onFileChanged(uri)),
	]

	if (settings.shouldRunRealtimeScanForWorkspace())
		realTimeListeners.forEach(listener => context.subscriptions.push(listener))


	/////////////////////////////
	// Other listeners
	/////////////////////////////

	const listeners = [
		vscode.extensions.onDidChange(watchtower.onExtensionsChanged.bind(watchtower)),

	]

	listeners.forEach(listener => context.subscriptions.push(listener))


	// WORKSPACE TRUST LISTENER
	context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => {
		console.log("Workspace trust granted")
		settingsTree.refresh()
		if (!settings.shouldRunRealtimeScanForWorkspace()) {
			console.log("Disposing real time listeners due to workspace trust change")
			realTimeListeners.forEach(listener => listener.dispose())
		}
	}))


	watchtower.checkWorkspaceTrustSettings()
	watchtower.showWhatsNewIfUpdated(context)
	watchtower.runInitialScan()

	if (vscode.window.activeTextEditor)
		watchtower.onActiveEditorChanged(vscode.window.activeTextEditor)
}

export function deactivate() { }
