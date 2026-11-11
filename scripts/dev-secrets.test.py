#!/usr/bin/env python3
"""Local secret lifecycle negative tests, isolated copies only."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('dev-secrets.py')
class SecretTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='aegis-secrets-')
        self.root = Path(self.temp.name)
        (self.root/'scripts').mkdir()
        shutil.copy(SCRIPT,self.root/'scripts/dev-secrets.py')
    def tearDown(self):
        self.temp.cleanup()
    def run_fixture(self):
        return subprocess.run([sys.executable,str(self.root/'scripts/dev-secrets.py')],capture_output=True,text=True)
    def test_generate_idempotently_with_private_modes(self):
        self.assertEqual(self.run_fixture().returncode,0)
        before={p.name:p.read_bytes() for p in (self.root/'.local').iterdir()}
        self.assertEqual(self.run_fixture().returncode,0)
        self.assertEqual(before,{p.name:p.read_bytes() for p in (self.root/'.local').iterdir()})
        self.assertEqual((self.root/'.local').stat().st_mode & 0o777,0o700)
        for file in (self.root/'.local').iterdir():
            self.assertEqual(file.stat().st_mode & 0o777,0o600)
    def test_negative_symlink_directory_and_config_rejected(self):
        elsewhere=self.root/'elsewhere';elsewhere.mkdir()
        (self.root/'.local').symlink_to(elsewhere,target_is_directory=True)
        self.assertNotEqual(self.run_fixture().returncode,0)
        self.assertEqual(list(elsewhere.iterdir()),[])
        (self.root/'.local').unlink()
        self.assertEqual(self.run_fixture().returncode,0)
        config=self.root/'.local/nats.conf';config.unlink();config.symlink_to(elsewhere/'outside')
        self.assertNotEqual(self.run_fixture().returncode,0)
        self.assertFalse((elsewhere/'outside').exists())
    def test_negative_unsafe_existing_password_and_config_rejected(self):
        self.assertEqual(self.run_fixture().returncode,0)
        for name in ['postgres-password','redis.conf','nats.conf']:
            target=self.root/'.local'/name;target.chmod(0o644)
            self.assertNotEqual(self.run_fixture().returncode,0)
            target.chmod(0o600)
if __name__ == '__main__':
    unittest.main()
