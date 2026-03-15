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

	const watchtower = Watchtower.getInstance(findingsTree, findingsOverview, settingsTree)


	/////////////////////////////
	// Views
	/////////////////////////////

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(FindingsTreeProvider.viewType, findingsTree)
	)
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(FindingsOverviewProvider.viewType, findingsOverview)
	)
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider(SettingsTreeProvider.viewType, settingsTree)
	)
	/////////////////////////////
	// Commands
	/////////////////////////////
	const commands = [
		vscode.commands.registerCommand('watchtower.scan', watchtower.commandRunScan.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.toggleWorkspaceStartupScan', watchtower.commandToggleWorkspaceStartupScan.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.toggleWorkspaceRealTime', watchtower.commandToggleWorkspaceRealTime.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.exportToJSON', () => exportToJSON(watchtower.findings, false)),
		vscode.commands.registerCommand('watchtower.showReport', () => showHTMLReport(watchtower.findings, context.extensionUri)),
		vscode.commands.registerCommand('watchtower.revealFinding', (finding) => findingsTree.revealFinding(finding)),
	]

	commands.forEach(command => context.subscriptions.push(command))


	/////////////////////////////
	// Real-time file listeners
	/////////////////////////////

	const watcher = vscode.workspace.createFileSystemWatcher('**/*')
	watcher.onDidCreate((uri) => watchtower.onFileCreated(uri))
	watcher.onDidChange((uri) => watchtower.onFileChanged(uri))

	const realTimeListeners = [
		vscode.workspace.onDidOpenTextDocument(watchtower.onFileOpened.bind(watchtower)),
		vscode.window.onDidChangeActiveTextEditor(watchtower.onActiveEditorChanged.bind(watchtower)),
		watcher
	]

	if (settings.shouldRunRealtimeScanForWorkspace())
		realTimeListeners.forEach(listener => context.subscriptions.push(listener))



	context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => {
		console.log("Workspace trust granted")
		settingsTree.refresh()
		if (!settings.shouldRunRealtimeScanForWorkspace()) {
			console.log("Disposing real time listeners due to workspace trust change")
			realTimeListeners.forEach(listener => listener.dispose())
		}
	}))



	watchtower.runInitialScan()


	if (vscode.window.activeTextEditor)
		watchtower.onActiveEditorChanged(vscode.window.activeTextEditor)


}

export function deactivate() { }
