import * as vscode from 'vscode'
import { AgentsAnalyzer } from './analyzers/agentsFile'
import { ScanLifecycle } from './scanLifecycle'
import { Watchtower } from './watchtower'



export function activate(context: vscode.ExtensionContext) {

	const watchtower = Watchtower.getInstance()
	const scanLifecycle = ScanLifecycle.getInstance(context)

	AgentsAnalyzer.isAgentFile(vscode.Uri.file('CLAUDE.md')), true

	// Commands
	console.log("Watchtower Extension Loaded")
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.scan', () => scanLifecycle.runManualScan()))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.enableProjectStartupScan', () => scanLifecycle.enableProjectStartupScan()))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.disableProjectStartupScan', () => scanLifecycle.disableProjectStartupScan()))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.enableProjectBackgroundProtections', () => scanLifecycle.enableBackgroundProtectionsForProject()))
	context.subscriptions.push(vscode.commands.registerCommand('watchtower.disableProjectBackgroundProtections', () => scanLifecycle.disableProjectBackgroundProtections()))

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
