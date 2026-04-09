---
name: new-release
description: Prepare a new release
agent: 'Security Auditor'
argument-hint: major, minor or (patch or release)

---

# Instructions

Go through git history and understand the changes implemented since the last release. You can find out the commit of the last release by searching for the tag in git. Use a mix of both checking the code changes and the commit messages to understand what changed.

Then you need to do the following tasks:

0. Prepare the new version. Increment the version based on the input from the user (major, minor or patch). At this point just calculate the new version, do not update anywhere

1. Create a proper changelog entry in CHANGELOG.md. Have in mind that the changes are to be consumed by users, so technical details or refactors are not as relevant, they can be mentioned but the focus should be on the new features, bug fixes and improvements that users will see.

2. Update the whats new

3. Run the npm run bump [major|minor|patch] command. This will bump the version in package.json and create a new git commit with the changes and tag the commit with the new version. Just run the command, everything else is automatically done by the script.
