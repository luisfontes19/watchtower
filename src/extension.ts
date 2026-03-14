import * as vscode from 'vscode'
import { Settings } from './settings'
import { showSettingsPanel } from './settingsPanel'
import { Watchtower } from './watchtower'



export function activate(context: vscode.ExtensionContext) {
	console.log("Watchtower Extension Loading")

	const settings = Settings.getInstance(context)
	const watchtower = Watchtower.getInstance(context.extensionUri)

	/////////////////////////////
	// Commands
	/////////////////////////////
	const commands = [
		vscode.commands.registerCommand('watchtower.scan', watchtower.commandRunScan.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.disableWorkspaceStartupScan', watchtower.commandDisableStartupScanForWorkspace.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.disableWorkspaceRealTimeDetection', watchtower.commandDisableRealTimeDetectionForWorkspace.bind(watchtower)),
		vscode.commands.registerCommand('watchtower.enableWorkspaceStartupScan', () => settings.setWorkspaceStartupScan(true)),
		vscode.commands.registerCommand('watchtower.enableWorkspaceRealTimeDetection', () => settings.setWorkspaceRealTimeDetection(true)),
		vscode.commands.registerCommand('watchtower.showSettings', showSettingsPanel),
	]

	commands.forEach(command => context.subscriptions.push(command))



	// If startup scans are off globally and no project overrides, skip all automatic scanning
	if (settings.shouldEnforceRestrictedScanOnlySetting()) {
		console.log('Watchtower: startupScans is set to OnUntrusted and workspace is trusted — skipping scans')
		return
	}


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

	realTimeListeners.forEach(listener => context.subscriptions.push(listener))


	context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => {
		// if user only wants scans on untrusted workspaces, and they just granted trust, dispose real-time listeners
		console.log("Workspace trust granted")
		if (settings.shouldEnforceRestrictedScanOnlySetting()) {
			console.log("Disposing real time listeners due to workspace trust change")
			realTimeListeners.forEach(listener => listener.dispose())
		}
	}))



	watchtower.runInitialScan()

	if (vscode.window.activeTextEditor)
		watchtower.onActiveEditorChanged(vscode.window.activeTextEditor)


}

export function deactivate() { }
