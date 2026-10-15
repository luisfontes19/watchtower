import * as vscode from 'vscode'

let channel: vscode.LogOutputChannel | undefined

function getChannel(): vscode.LogOutputChannel {
    channel ??= vscode.window.createOutputChannel('Watchtower', { log: true })
    return channel
}

/** Logs to the "Watchtower" channel in the Output panel. Verbosity follows the channel's log level. */
export const logger = {
    debug: (message: string, ...args: unknown[]) => getChannel().debug(message, ...args),
    info: (message: string, ...args: unknown[]) => getChannel().info(message, ...args),
    warn: (message: string, ...args: unknown[]) => getChannel().warn(message, ...args),
    error: (message: string | Error, ...args: unknown[]) => getChannel().error(message, ...args),
    show: (preserveFocus = true) => getChannel().show(preserveFocus),
    dispose: () => {
        channel?.dispose()
        channel = undefined
    },
}
