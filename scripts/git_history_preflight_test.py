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
        self.assertEqual(scanned_commits('INF 12 commits scanned.\n'), 12)
        with self.assertRaisesRegex(ValueError, 'positive'):
            scanned_commits('INF 0 commits scanned.\n')
        with self.assertRaisesRegex(ValueError, 'error'):
            scanned_commits('ERR fatal: not a git repository\nINF 12 commits scanned.\n')


if __name__ == '__main__':
    unittest.main()
