## Git

### What is Git?
Git is a distributed version control system. Each clone contains repository history, so developers can commit locally, inspect changes, branch, and merge without constant access to a central server. A remote such as GitHub is a collaboration and backup point, not the only copy of the history.
```bash
git init
git add .
git commit -m "Add initial project files"
```

### What is the difference between git fetch and git pull?
`git fetch` downloads remote commits and updates remote-tracking references without changing the current branch. `git pull` fetches and then integrates those commits by merge or rebase, depending on options and configuration. Fetch first when you want to inspect incoming work before integrating it.

```bash
git fetch origin
git log --oneline HEAD..origin/main
git merge origin/main
```

### What is a merge conflict, and how do you resolve it?
A merge conflict occurs when Git cannot automatically combine changes to the same part of a file. Check the conflicted paths with `git status`, edit the files to the intended result, remove conflict markers, run the relevant checks, and stage the resolved files. Then complete the merge or rebase with the appropriate continue command.
```bash
git status
# Edit conflicted files and remove <<<<<<<, =======, and >>>>>>> markers.
git add path/to/resolved-file
git merge --continue  # or finish the rebase with: git rebase --continue
```

### How do you revert a commit?
`git revert <commit>` creates a new commit that applies the inverse of an earlier commit, preserving shared history. It is usually the safe choice on a branch others have already fetched. Reverting a merge commit requires choosing the mainline parent with `-m`.

```bash
git revert a1b2c3d
```

### What is Git stash?
Stash temporarily saves tracked working-tree changes so you can switch tasks without making a commit. Use `git stash push -m "message"`, then `git stash list` and `git stash pop` or `git stash apply` to restore work. Untracked files require `-u`; stashes are local and should not replace commits for durable work.
```bash
git stash push -u -m "work in progress"
git stash list
git stash pop
```

### How do git merge and git rebase differ?
Merge combines histories and usually creates a merge commit, preserving the branch structure. Rebase replays commits onto a new base, producing a linear history but changing commit IDs. Do not rebase commits that other people rely on unless the team has coordinated the rewrite.
```bash
git switch feature
git merge main

# Or replay feature commits on top of main:
git rebase main
```

### How do you squash commits?
Use an interactive rebase to combine a sequence of commits into a smaller set. Change later `pick` commands to `squash` or `fixup`, review the resulting commit message, then finish the rebase. If the commits were already pushed to a shared branch, coordinate before force-pushing.

```bash
git rebase -i HEAD~3
```

### What is a Git submodule?
A submodule records a specific commit from another Git repository inside the current repository. It is useful when an external dependency must remain a separate project, but adds update and clone steps. Add and initialize one with:

```bash
git submodule add https://example.com/team/library.git vendor/library
git submodule update --init --recursive
```

### How do you perform an interactive rebase?
Run `git rebase -i <base>` to edit commits after the chosen base. The todo list lets you reorder, reword, squash, fix up, or drop commits. Resolve conflicts and use `git rebase --continue`; use `git rebase --abort` to return to the original branch state.
```bash
git rebase -i HEAD~3
# In the todo list, change later "pick" entries to "squash" or "reword".
git rebase --continue
```

### What does git reflog do?
The reflog records recent local changes to branch and `HEAD` references, including commits that may no longer be reachable by a branch name. Use `git reflog` to locate a lost commit, then recover it by creating a branch or resetting to its hash. Reflogs are local and expire, so they are not a substitute for a remote backup.
```bash
git reflog
# Recover a commit by creating a branch at its reflog hash:
git branch recovery HEAD@{2}
```
