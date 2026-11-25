## Git

### What is Git?
Git is a distributed version control system. Each clone contains repository history, so developers can commit locally, inspect changes, branch, and merge without constant access to a central server. A remote such as GitHub is a collaboration and backup point, not the only copy of the history.

Git stores snapshots as commits connected by parent references, rather than saving a separate full copy for every revision. Branches are lightweight references, which makes creating and switching between lines of work inexpensive. A commit is local until it is pushed to a remote, so back up important branches.

```bash
git init
git add .
git commit -m "Add initial project files"
```

### What is the difference between git fetch and git pull?
`git fetch` downloads remote commits and updates remote-tracking references without changing the current branch. `git pull` fetches and then integrates those commits by merge or rebase, depending on options and configuration. Fetch first when you want to inspect incoming work before integrating it.


Fetching is safer when a branch has local work or when you want to review a pull request update before integrating it. After fetching, compare commits and inspect diffs to understand incoming changes. Pull is convenient for a clean branch, but its merge or rebase behavior should be understood by the team.

```bash
git fetch origin
git log --oneline HEAD..origin/main
git merge origin/main
```

### What is a merge conflict, and how do you resolve it?
A merge conflict occurs when Git cannot automatically combine changes to the same part of a file. Check the conflicted paths with `git status`, edit the files to the intended result, remove conflict markers, run the relevant checks, and stage the resolved files. Then complete the merge or rebase with the appropriate continue command.

Conflict markers show competing versions, not necessarily the entire semantic conflict; inspect surrounding code and understand the intent of both changes. A conflict can also occur in binary files or rename operations and may require choosing one version. After resolution, review the staged diff before completing integration.

```bash
git status
# Edit conflicted files and remove <<<<<<<, =======, and >>>>>>> markers.
git add path/to/resolved-file
git merge --continue  # or finish the rebase with: git rebase --continue
```

### How do you revert a commit?
`git revert <commit>` creates a new commit that applies the inverse of an earlier commit, preserving shared history. It is usually the safe choice on a branch others have already fetched. Reverting a merge commit requires choosing the mainline parent with `-m`.


Revert is appropriate for a published change because it adds a new commit without rewriting the history other collaborators already have. For a commit that exists only locally, `git reset` may be suitable, but it moves branch history and can discard work depending on the mode. Identify merge commits carefully before reverting.

```bash
git revert a1b2c3d
```

### What is Git stash?
Stash temporarily saves tracked working-tree changes so you can switch tasks without making a commit. Use `git stash push -m "message"`, then `git stash list` and `git stash pop` or `git stash apply` to restore work. Untracked files require `-u`; stashes are local and should not replace commits for durable work.

A stash is a short-term convenience, not a durable backup: it lives in the local repository and is easy to forget. Stash can also preserve staged and unstaged changes separately, and untracked files need the `-u` option. For work that may need review or survive machine changes, make a WIP branch and commit.

```bash
git stash push -u -m "work in progress"
git stash list
git stash pop
```

### How do git merge and git rebase differ?
Merge combines histories and usually creates a merge commit, preserving the branch structure. Rebase replays commits onto a new base, producing a linear history but changing commit IDs. Do not rebase commits that other people rely on unless the team has coordinated the rewrite.

Merge preserves the original branch ancestry, which can make it easier to see when work was integrated. Rebase rewrites the commits being replayed, so their hashes and signatures change even when the file content is similar. Teams often rebase private feature branches and merge reviewed changes according to repository policy.

```bash
git switch feature
git merge main

# Or replay feature commits on top of main:
git rebase main
```

### How do you squash commits?
Use an interactive rebase to combine a sequence of commits into a smaller set. Change later `pick` commands to `squash` or `fixup`, review the resulting commit message, then finish the rebase. If the commits were already pushed to a shared branch, coordinate before force-pushing.


Squashing can make a pull request easier to review by removing temporary fix-up commits, but preserve meaningful logical boundaries when they aid future debugging. Interactive rebase edits local history; if the commits have been published, push the rewritten branch only when collaborators are coordinated and the repository policy permits it.

```bash
git rebase -i HEAD~3
```

### What is a Git submodule?
A submodule records a specific commit from another Git repository inside the current repository. It is useful when an external dependency must remain a separate project, but adds update and clone steps. Add and initialize one with:


The parent repository stores the submodule URL and a specific commit pointer, not a copy of the submodule history. Cloning requires initializing and updating submodules, and updating the dependency means committing the new pointer in the parent repository. Use submodules when independent version control is valuable enough to justify this extra workflow.

```bash
git submodule add https://example.com/team/library.git vendor/library
git submodule update --init --recursive
```

### How do you perform an interactive rebase?
Run `git rebase -i <base>` to edit commits after the chosen base. The todo list lets you reorder, reword, squash, fix up, or drop commits. Resolve conflicts and use `git rebase --continue`; use `git rebase --abort` to return to the original branch state.

The base should be the commit immediately before the range you intend to edit; verify it with `git log` first. Rebase can pause for conflicts or for an edit action, and `--continue` resumes after changes are staged. Keep a clean working tree and remember `--abort` is available if the operation goes wrong.

```bash
git rebase -i HEAD~3
# In the todo list, change later "pick" entries to "squash" or "reword".
git rebase --continue
```

### What does git reflog do?
The reflog records recent local changes to branch and `HEAD` references, including commits that may no longer be reachable by a branch name. Use `git reflog` to locate a lost commit, then recover it by creating a branch or resetting to its hash. Reflogs are local and expire, so they are not a substitute for a remote backup.

The reflog is especially useful after an accidental reset, amend, or branch movement because the commit may still exist locally even when no branch points to it. Reflog entries are local and expire over time. Once you identify the desired commit, create a recovery branch before performing further history edits.

```bash
git reflog
# Recover a commit by creating a branch at its reflog hash:
git branch recovery HEAD@{2}
```

### Rebase vs merge; undoing a bad shared commit; conflicts?
Rebase your own local feature branch onto the latest main to get a clean, linear history before opening a PR. Merge when the branch is shared or already public (never rewrite shared history), or when you want to preserve the branch context.
Undo a bad commit on a shared branch: use git revert <sha>, which adds a new commit that reverses the change and is safe for everyone. Do not reset --hard and force-push a shared branch.
Resolving conflicts safely: pull the latest main first, run git status and git diff --name-only --diff-filter=U to see conflicts, understand both sides (check git log for intent), resolve manually, run the tests, then git add and continue. If you get lost, git rebase --abort or git merge --abort returns you to a clean state. Use git rerere and small, frequent merges to reduce pain.
