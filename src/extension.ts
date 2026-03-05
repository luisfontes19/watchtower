import * as vscode from 'vscode'
import { ScanLifecycle } from './scanLifecycle'
import { Watchtower } from './watchtower'



export function activate(context: vscode.ExtensionContext) {

	const watchtower = Watchtower.getInstance()
	const scanLifecycle = ScanLifecycle.getInstance(context)

	// Commands
	console.log("Watchtower Extension Loaded")
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.scan', () => scanLifecycle.runManualScan()))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.enableStartupScan', () => scanLifecycle.enableStartupScan()))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.disableStartupScan', () => scanLifecycle.disableStartupScan()))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.enableBackgroundProtections', () => scanLifecycle.enableBackgroundProtections()))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.disableBackgroundProtections', () => scanLifecycle.disableBackgroundProtections()))


	// Listeners
	context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(watchtower.onWorkspaceTrusted.bind(watchtower)))
	// context.subscriptions.push(vscode.tasks.onDidStartTask(watchtower.onDidStartTask.bind(watchtower)))
	// context.subscriptions.push(vscode.workspace.onWillSaveTextDocument(watchtower.onWillSaveFile.bind(watchtower)))
	// context.subscriptions.push(vscode.workspace.onWillCreateFiles(watchtower.onWillCreateFiles.bind(watchtower)))


	const watcher = vscode.workspace.createFileSystemWatcher('**/*')
	watcher.onDidCreate((uri) => watchtower.onFileCreated(uri, scanLifecycle))
	watcher.onDidChange((uri) => watchtower.onFileChanged(uri, scanLifecycle))


	context.subscriptions.push(watcher)

	// Run initial scan based on ScanLifecycle logic
	scanLifecycle.runInitialScan()

}

export function deactivate() { }
