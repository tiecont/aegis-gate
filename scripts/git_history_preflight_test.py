import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from history_scan_evidence import scanned_commits


def commit_count(git_dir, work_tree):
    environment = os.environ.copy()
    environment.update(GIT_DIR=str(git_dir), GIT_WORK_TREE=str(work_tree))
    result = subprocess.run(
        ['git', '--git-dir', str(git_dir), '--work-tree', str(work_tree), 'rev-list', '--all', '--count'],
        cwd=work_tree, env=environment, check=True, capture_output=True, text=True)
    count = int(result.stdout.strip())
    if count <= 0:
        raise ValueError('history scan requires at least one commit')
    return count


class GitHistoryPreflightTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='aegis-history-'))
        self.addCleanup(shutil.rmtree, self.root)
        self.source = self.root / 'source'
        self.source.mkdir()
        subprocess.run(['git', 'init', '--quiet', str(self.source)], check=True)
        for key, value in {'user.email': 'test@example.invalid', 'user.name': 'Aegis test'}.items():
            subprocess.run(['git', '-C', str(self.source), 'config', key, value], check=True)
        for index in range(12):
            (self.source / 'tracked.txt').write_text(f'owned fixture {index}\n')
            subprocess.run(['git', '-C', str(self.source), 'add', 'tracked.txt'], check=True)
            subprocess.run(['git', '-C', str(self.source), 'commit', '--quiet', '-m', f'fixture {index}'], check=True)

    def test_full_clone_and_linked_worktree_have_history(self):
        common = subprocess.check_output(
            ['git', '-C', str(self.source), 'rev-parse', '--path-format=absolute', '--git-common-dir'], text=True).strip()
        self.assertEqual(commit_count(common, self.source), 12)
        linked = self.root / 'path with spaces' / 'linked'
        linked.parent.mkdir()
        subprocess.run(['git', '-C', str(self.source), 'worktree', 'add', '--quiet', str(linked)], check=True)
        linked_common = subprocess.check_output(
            ['git', '-C', str(linked), 'rev-parse', '--path-format=absolute', '--git-common-dir'], text=True).strip()
        self.assertEqual(commit_count(linked_common, linked), 12)

    def test_inaccessible_common_directory_fails_closed(self):
        with self.assertRaises(subprocess.CalledProcessError):
            commit_count(self.root / 'missing-common', self.source)

    def test_history_log_parser_is_exact_and_fail_closed(self):
        self.assertEqual(scanned_commits('INF 10 commits scanned.\n'), 10)
        self.assertEqual(scanned_commits('INF 12 commits scanned.\n'), 12)
        with self.assertRaisesRegex(ValueError, 'positive'):
            scanned_commits('INF 0 commits scanned.\n')
        for error in ('ERR fatal: not a git repository', 'ERROR history unavailable', 'FATAL missing history'):
            with self.subTest(error=error), self.assertRaisesRegex(ValueError, 'error'):
                scanned_commits(error + '\nINF 12 commits scanned.\n')

    def test_real_container_clone_worktree_and_missing_git(self):
        image = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f'
        clone = self.root / 'full clone'
        subprocess.run(['git', 'clone', '--quiet', '--no-local', str(self.source), str(clone)], check=True)
        linked = self.root / 'container path with spaces' / 'linked'
        linked.parent.mkdir()
        subprocess.run(['git', '-C', str(self.source), 'worktree', 'add', '--quiet', str(linked)], check=True)
        for work_tree in (clone, linked):
            common = subprocess.check_output(
                ['git', '-C', str(work_tree), 'rev-parse', '--path-format=absolute', '--git-common-dir'], text=True).strip()
            args = ['docker', 'run', '--rm', '--user', f'{os.getuid()}:{os.getgid()}',
                    '-e', 'GIT_DIR=/git-common', '-e', 'GIT_WORK_TREE=/repo',
                    '-v', f'{work_tree}:/repo:ro', '-v', f'{common}:/git-common:ro']
            with self.subTest(work_tree=work_tree):
                preflight = subprocess.run(args + ['--entrypoint', '/bin/sh', image, '-c',
                    'set -eu; count=$(git rev-list --all --count); test "$count" -gt 0; echo "$count"'],
                    check=True, capture_output=True, text=True)
                self.assertEqual(int(preflight.stdout), 12)
                scanned = subprocess.run(args + [image, 'git', '/repo', '--redact', '--no-banner', '--log-opts=--all'],
                                         check=True, capture_output=True, text=True)
                self.assertEqual(scanned_commits(scanned.stdout + scanned.stderr), 12)
        missing = subprocess.run(['docker', 'run', '--rm', '-e', 'GIT_DIR=/missing',
                                  '--entrypoint', '/bin/sh', image, '-c',
                                  'set -eu; count=$(git rev-list --all --count); test "$count" -gt 0'],
                                 capture_output=True, text=True)
        self.assertNotEqual(missing.returncode, 0)


if __name__ == '__main__':
    unittest.main()
