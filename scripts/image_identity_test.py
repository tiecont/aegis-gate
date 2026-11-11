import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

from image_identity import config_digest


class IdentityTests(unittest.TestCase):
    def test_oci_chain_and_substitution_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'image.tar'
            blobs = {}

            def add(value):
                data = json.dumps(value).encode()
                digest = 'sha256:' + hashlib.sha256(data).hexdigest()
                blobs['blobs/sha256/' + digest.split(':')[1]] = data
                return digest

            config = add({'architecture': 'amd64', 'os': 'linux'})
            manifest = add({'config': {'digest': config}})
            image = add({'manifests': [{'digest': manifest, 'platform': {'architecture': 'amd64', 'os': 'linux'}}]})

            def write():
                with tarfile.open(archive, 'w') as tar:
                    for name, data in blobs.items():
                        member = tarfile.TarInfo(name)
                        member.size = len(data)
                        tar.addfile(member, io.BytesIO(data))

            write()
            self.assertEqual(config_digest(archive, image, 'amd64', 'linux'), config)
            with self.assertRaisesRegex(ValueError, 'platform'):
                config_digest(archive, image, 'arm64', 'linux')
            blobs['blobs/sha256/' + config.split(':')[1]] = b'{}'
            write()
            with self.assertRaisesRegex(ValueError, 'digest mismatch'):
                config_digest(archive, image, 'amd64', 'linux')

    def test_classic_store_config_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'classic.tar'
            config = b'{"architecture":"amd64","os":"linux"}'
            image = 'sha256:' + hashlib.sha256(config).hexdigest()
            with tarfile.open(archive, 'w') as tar:
                for name, data in [('config.json', config), ('manifest.json', b'[{"Config":"config.json"}]')]:
                    member = tarfile.TarInfo(name)
                    member.size = len(data)
                    tar.addfile(member, io.BytesIO(data))
            self.assertEqual(config_digest(archive, image, 'amd64', 'linux'), image)
            with self.assertRaisesRegex(ValueError, 'does not match'):
                config_digest(archive, 'sha256:' + '0' * 64, 'amd64', 'linux')


if __name__ == '__main__':
    unittest.main()
