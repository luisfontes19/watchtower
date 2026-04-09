---
name: new-release
description: Prepare a new release
argument-hint: major, minor, [patch or release] or same

---

# Instructions

Go through git history and understand the changes implemented since the last release. You can find out the commit of the last release by searching for the tag in git. Use a mix of both checking the code changes and the commit messages to understand what changed.

Then you need to do the following tasks:

0. Prepare the new version. Increment the version based on the input from the user (major, minor or patch). At this point just calculate the new version, do not update anywhere.
  * If no user input provided assume its the next patch version.
  * If 'same' is provided as input, do not increment the version (ignore step 0 and step 3)

1. Create a proper changelog entry in CHANGELOG.md. Have in mind that the changes are to be consumed by users, so technical details or refactors are not as relevant, they can be mentioned but the focus should be on the new features, bug fixes and improvements that users will see.
  * Prefer to use screenshots to show new features. Set the tag there and ask me to take a screenshot.
  * Each new thing should be a level 3 title.
  * Bundle all bug fixes into a "Bug Fixes" with each fix as a bullet point, without going into too much technical details. The focus should be on what was the issue and how it affects users, not on how it was fixed.
  * Bundle all small tweaks and improvements that are not new features or bug fixes into an "Improvements" section, with each improvement as a bullet point. Again, the focus should be on how it affects users, not on the technical details.

2. Commit the changes

3. Run the npm run bump:[major|minor|patch] command. This will bump the version in package.json and create a new git commit with the changes and tag the commit with the new version. Just run the command, everything else is automatically done by the script.
