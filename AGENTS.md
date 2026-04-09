# Instructions

This is a vscode extension written in typescript and it is a security agent that scans the user's workspace for potential security issues and alerts the user about them. It also has a side panel where users can see the findings and manage the extension settings.

Things to have in mind when working on this extension:

* extension.ts is where all the components are registered. Commands, listeners, UI, etc. If the component is a UI, it should reference a provider that is responsible for providing the data and logic for that UI component. For listeners and commands, the declaration should invoke a method on `watchtower.ts` where all the main logic is managed
