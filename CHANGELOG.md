# Whats New

## [0.4.0]

### What's New page

When the extension is updated, the changelog is now automatically shown as a Markdown preview so you never miss what changed. You can also trigger it anytime via the command palette with `Watchtower: What's New?`.

### New Actions panel

A dedicated "Actions" view has been added to the Watchtower sidebar for quick access to common operations.

![New Actions panel](data/images/new-actions-panel.jpg)

### Scan Extension for Malware

New command (`Watchtower: Scan Extension for Malware`) lets you manually check any VS Code extension ID against Aikido threat intelligence to see if it has been flagged as malicious.

### Redesigned Settings panel

The Settings view is now a flat, interactive list. Each setting can be toggled or cycled directly by clicking it, without needing to open VS Code settings.

![Redesigned Settings panel](data/images/redesigned-settings-panel.jpg)

### Bug Fixes

* Malicious extension detection was sometimes failing to flag known bad extensions due to an incorrect filter on the threat intelligence API response.

## [0.3.1]

* Update README for better SEO

## [0.3.0]

* Add support for detecting malicious extensions using Aikido threat intelligence. Now, when new extensions are enabled, Watchtower will check if they are flagged as malicious and alert the user with a warning message and an option to uninstall the extension immediately.
* Fix bug that added new findings every time a file was changed in the background. So the findings list could have 10 findings for the same file changed in the background. This is now fixed. Alerts on file change are still shown on every change.

## [0.2.3]

* Fix bugs with file path detections

## [0.2.2]

* Add support for monitoring AI related files configured in chat settings from VSCode.
* Add setting to ignore specific folders from being scanned, such as node_modules or .venv
* Set extension settings with scope `application` to avoid being overridden by workspace settings

## [0.2.1]

* Fix bug that prevented from finding venv binaries in the project
* Changed default scan setting to scan on all projects

## [0.2.0]

* New Sidepanel view to show findings and view/manage current settings status
* Add analyzer for python virtual environments in the project
* Refactored extension settings
* Revampted HTML finding report

## [0.1.4]

* Fixed bug that showed an alert everytime most of the files were edited in the background, even if there wasn't anything to report. Now we only report files edited in the background if:
  * Its an AI related file
  * Its a vscode file: launch.json, tasks.json, settings.json
* Added the command `Watchtower: Show Settings Status` to see active configuration for current workspace ()
* Merged the commands `enableStartupScans` and `runOnlyOnRestrictedWorkspaces` into `startupScans` where you can now choose between 3 options: `OnEveryProject`, `OnUntrusted`, `Off`
* Added scanner for package.json files to search for preinstall scripts
* Fixed bug where global settings took precedence over workspace settings, now workspace settings will take precedence.
* Improved alert for file changed

## [0.1.3]

* Do not scan binary files.
* Bundled trojansource findings per file in report
* Fixed issues with emojis being reported as invisible chars
* Fix crash when displaying inline findings

## [0.1.2]

- Initial release
