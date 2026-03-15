# Change Log

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
