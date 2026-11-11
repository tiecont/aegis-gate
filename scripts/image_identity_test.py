import copy
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

from image_identity import CONFIG_TYPES, INDEX_TYPES, MANIFEST_TYPES, config_digest, verify_scan


CONFIG = 'application/vnd.oci.image.config.v1+json'
MANIFEST = 'application/vnd.oci.image.manifest.v1+json'
INDEX = 'application/vnd.oci.image.index.v1+json'


class IdentityTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.archive = Path(self.directory.name) / 'image.tar'
        self.entries = {}
        # Real Docker/OCI config shape: runtime config is not a descriptor.
        self.config = {'architecture': 'amd64', 'os': 'linux',
                       'config': {'Env': ['PATH=/usr/bin'], 'Cmd': ['python3'],
                                  'Labels': {'org.aegisgate.scope': 'unsafe-local-fixture'}},
                       'rootfs': {'type': 'layers', 'diff_ids': []}, 'history': []}

    def add(self, value, media_type):
        data = json.dumps(value).encode()
        digest = 'sha256:' + hashlib.sha256(data).hexdigest()
        self.entries['blobs/sha256/' + digest.split(':')[1]] = data
        return {'mediaType': media_type, 'size': len(data), 'digest': digest}

    def manifest(self, config=None, media_type=MANIFEST, config_type=CONFIG, layers=None):
        config = self.add(self.config if config is None else config, config_type)
        manifest = self.add({'schemaVersion': 2, 'mediaType': media_type,
                             'config': config, 'layers': [] if layers is None else layers}, media_type)
        return manifest, config

    def index(self, entries, media_type=INDEX):
        return self.add({'schemaVersion': 2, 'mediaType': media_type, 'manifests': entries}, media_type)

    def platform(self, entry, architecture='amd64', operating_system='linux', variant=None):
        result = copy.deepcopy(entry)
        result['platform'] = {'architecture': architecture, 'os': operating_system}
        if variant is not None:
            result['platform']['variant'] = variant
        return result

    def write(self, extra=None):
        with tarfile.open(self.archive, 'w') as tar:
            for name, data in self.entries.items():
                member = tarfile.TarInfo(name)
                member.size = len(data)
                tar.addfile(member, io.BytesIO(data))
            if extra is not None:
                tar.addfile(extra, io.BytesIO(b'{}') if extra.isfile() else None)

    def check(self, image, architecture='amd64', operating_system='linux', variant=''):
        self.write()
        return config_digest(self.archive, image, architecture, operating_system, variant)

    def classic(self, config=None, layers=None):
        data = json.dumps(self.config if config is None else config).encode()
        image = 'sha256:' + hashlib.sha256(data).hexdigest()
        name = image.split(':')[1] + '.json'
        self.entries[name] = data
        self.entries['manifest.json'] = json.dumps([{'Config': name, 'RepoTags': [],
                                                    'Layers': [] if layers is None else layers}]).encode()
        return image

    def layer_graph(self, compressed=True):
        layers = []
        names = []
        diff_ids = []
        for index in range(2):
            stream = io.BytesIO()
            with tarfile.open(fileobj=stream, mode='w') as tar:
                data = f'fixture-layer-{index}'.encode()
                member = tarfile.TarInfo(f'file-{index}')
                member.size = len(data)
                tar.addfile(member, io.BytesIO(data))
            raw = stream.getvalue()
            diff_ids.append('sha256:' + hashlib.sha256(raw).hexdigest())
            name = f'layer-{index}/layer.tar'
            self.entries[name] = raw
            names.append(name)
            data = gzip.compress(raw, mtime=0) if compressed else raw
            digest = 'sha256:' + hashlib.sha256(data).hexdigest()
            self.entries['blobs/sha256/' + digest.split(':')[1]] = data
            layers.append({'mediaType': 'application/vnd.oci.image.layer.v1.tar' + ('+gzip' if compressed else ''),
                           'digest': digest, 'size': len(data)})
        self.config['rootfs']['diff_ids'] = diff_ids
        return layers, names

    def test_classic_runtime_config_regression(self):
        image = self.classic()
        self.assertEqual(self.check(image), image)

    def test_config_blob_runtime_config_regression(self):
        config = self.add(self.config, CONFIG)
        self.entries['manifest.json'] = json.dumps([{'Config': 'blobs/sha256/' + config['digest'].split(':')[1],
                                                    'Layers': []}]).encode()
        self.assertEqual(self.check(config['digest']), config['digest'])

    def test_classic_layers_and_substitution(self):
        _, names = self.layer_graph()
        image = self.classic(layers=names)
        self.assertEqual(self.check(image), image)
        self.entries[names[0]] = self.entries[names[1]]
        with self.assertRaisesRegex(ValueError, 'ordered config diff IDs'):
            self.check(image)

    def test_classic_layer_count_order_and_missing_refs(self):
        _, names = self.layer_graph()
        for refs in (names[:1], names + [names[0]], list(reversed(names)),
                     [names[0], names[0]], [names[0], '../layer.tar'],
                     [names[0], 'absent/layer.tar']):
            image = self.classic(layers=refs)
            with self.subTest(refs=refs), self.assertRaises(ValueError):
                self.check(image)

    def test_oci_layer_content_binding_plain_and_gzip(self):
        for compressed in (False, True):
            layers, _ = self.layer_graph(compressed)
            manifest, config = self.manifest(layers=layers)
            image = self.index([self.platform(manifest)])
            self.assertEqual(self.check(image['digest']), config['digest'])
            self.entries['blobs/sha256/' + layers[0]['digest'].split(':')[1]] = b'substituted'
            with self.assertRaisesRegex(ValueError, 'layer (digest|descriptor size) mismatch'):
                self.check(image['digest'])

    def test_oci_layer_descriptor_size_digest_count_and_order(self):
        layers, _ = self.layer_graph()
        wrong_size = copy.deepcopy(layers)
        wrong_size[0]['size'] += 1
        wrong_digest = copy.deepcopy(layers)
        wrong_digest[0]['digest'] = 'sha256:' + '0' * 64
        wrong_type = copy.deepcopy(layers)
        wrong_type[0]['mediaType'] = CONFIG
        for entries in (wrong_size, wrong_digest, wrong_type, layers[:1], layers + layers[:1], list(reversed(layers))):
            manifest, _ = self.manifest(layers=entries)
            with self.subTest(layers=entries), self.assertRaises(ValueError):
                self.check(manifest['digest'])

    def test_oci_rehashed_substituted_layer_cannot_keep_config(self):
        layers, _ = self.layer_graph()
        replaced = copy.deepcopy(layers)
        replaced[0] = layers[1]
        manifest, _ = self.manifest(layers=replaced)
        with self.assertRaisesRegex(ValueError, 'ordered config diff IDs'):
            self.check(manifest['digest'])

    def test_conflicting_classic_and_oci_scan_entry_points(self):
        layers, names = self.layer_graph()
        manifest, _ = self.manifest(layers=layers)
        self.classic(layers=names)
        self.assertEqual(self.check(manifest['digest']), self.add(self.config, CONFIG)['digest'])
        self.classic(layers=list(reversed(names)))
        with self.assertRaisesRegex(ValueError, 'ordered config diff IDs'):
            self.check(manifest['digest'])
        self.classic(dict(self.config, architecture='arm64'), layers=names)
        with self.assertRaisesRegex(ValueError, 'Legacy config differs'):
            self.check(manifest['digest'])

    def test_oci_archive_entry_point_binding(self):
        layers, _ = self.layer_graph()
        manifest, config = self.manifest(layers=layers)
        index = {'schemaVersion': 2, 'mediaType': INDEX, 'manifests': [manifest]}
        self.entries['index.json'] = json.dumps(index).encode()
        self.assertEqual(self.check(manifest['digest']), config['digest'])
        altered, _ = self.manifest(layers=list(reversed(layers)))
        index['manifests'] = [altered]
        self.entries['index.json'] = json.dumps(index).encode()
        with self.assertRaisesRegex(ValueError, 'entry point does not match'):
            self.check(manifest['digest'])

    def test_optional_oci_document_media_types(self):
        layers, _ = self.layer_graph()
        config = self.add(self.config, CONFIG)
        manifest = self.add({'schemaVersion': 2, 'config': config, 'layers': layers}, MANIFEST)
        index = self.add({'schemaVersion': 2, 'manifests': [self.platform(manifest)]}, INDEX)
        for entry in (manifest, index):
            with self.subTest(root=entry['mediaType']):
                self.entries['index.json'] = json.dumps({'schemaVersion': 2, 'manifests': [entry]}).encode()
                self.assertEqual(self.check(entry['digest']), config['digest'])
        del self.entries['index.json']
        self.assertEqual(self.check(index['digest']), config['digest'])

    def test_docker_save_config_identity_with_oci_entry_point(self):
        layers, names = self.layer_graph()
        manifest, config = self.manifest(layers=layers)
        self.entries['manifest.json'] = json.dumps([{
            'Config': 'blobs/sha256/' + config['digest'].split(':')[1],
            'Layers': names}]).encode()
        self.entries['index.json'] = json.dumps({'schemaVersion': 2, 'mediaType': INDEX,
                                                'manifests': [manifest]}).encode()
        self.assertEqual(self.check(config['digest']), config['digest'])
        self.entries[names[0]] = self.entries[names[1]]
        with self.assertRaisesRegex(ValueError, 'ordered config diff IDs'):
            self.check(config['digest'])

    def test_config_identity_does_not_bypass_manifest_validation(self):
        config = self.add(self.config, CONFIG)
        for schema, media_type in ((1, MANIFEST), (2, INDEX), (2, 'application/json')):
            manifest = self.add({'schemaVersion': schema, 'mediaType': media_type,
                                 'config': config, 'layers': []}, MANIFEST)
            self.entries['index.json'] = json.dumps({'schemaVersion': 2, 'manifests': [manifest]}).encode()
            with self.subTest(schema=schema, media_type=media_type), self.assertRaises(ValueError):
                self.check(config['digest'])

    def test_archive_index_can_be_the_requested_identity(self):
        manifest, config = self.manifest()
        index = self.index([self.platform(manifest)])
        self.entries['index.json'] = self.entries['blobs/sha256/' + index['digest'].split(':')[1]]
        del self.entries['blobs/sha256/' + index['digest'].split(':')[1]]
        self.assertEqual(self.check(index['digest']), config['digest'])

    def test_docker_save_wrapper_platform_cannot_conflict(self):
        manifest, config = self.manifest()
        entry = self.platform(manifest, 'arm64')
        self.entries['index.json'] = json.dumps({'schemaVersion': 2, 'manifests': [entry]}).encode()
        with self.assertRaisesRegex(ValueError, 'platform mismatch'):
            self.check(config['digest'])

    def test_explicit_null_or_conflicting_media_types_rejected(self):
        manifest, _ = self.manifest()
        for value in (None, 'application/json', MANIFEST):
            self.entries['index.json'] = json.dumps({'schemaVersion': 2, 'mediaType': value,
                                                    'manifests': [manifest]}).encode()
            with self.subTest(media_type=value), self.assertRaises(ValueError):
                self.check(manifest['digest'])
        del self.entries['index.json']
        for value in (None, 'application/json', []):
            entry = self.add(dict(self.config, mediaType=value), CONFIG)
            with self.subTest(media_type=value), self.assertRaises(ValueError):
                self.check(entry['digest'])

    def test_oci_manifest_and_index(self):
        manifest, config = self.manifest()
        image = self.index([self.platform(manifest)])
        for identity in (manifest['digest'], image['digest']):
            with self.subTest(identity=identity):
                self.assertEqual(self.check(identity), config['digest'])

    def test_docker_schema2_manifest_and_list(self):
        manifest_type = next(value for value in MANIFEST_TYPES if value != MANIFEST)
        index_type = next(value for value in INDEX_TYPES if value != INDEX)
        config_type = next(value for value in CONFIG_TYPES if value != CONFIG)
        manifest, config = self.manifest(media_type=manifest_type, config_type=config_type)
        image = self.index([self.platform(manifest)], index_type)
        self.assertEqual(self.check(image['digest']), config['digest'])

    def test_multi_platform_selection(self):
        amd_manifest, amd_config = self.manifest()
        arm = dict(self.config, architecture='arm64', variant='v8')
        arm_manifest, arm_config = self.manifest(arm)
        image = self.index([self.platform(amd_manifest), self.platform(arm_manifest, 'arm64', variant='v8')])
        self.assertEqual(self.check(image['digest']), amd_config['digest'])
        self.assertEqual(self.check(image['digest'], 'arm64', variant='v8'), arm_config['digest'])
        with self.assertRaisesRegex(ValueError, 'platform'):
            self.check(image['digest'], 'arm64')

    def test_classic_substitution_and_platform_mismatch(self):
        image = self.classic()
        for arch, os_name in [('arm64', 'linux'), ('amd64', 'windows')]:
            with self.subTest(arch=arch, os=os_name), self.assertRaisesRegex(ValueError, 'platform'):
                self.check(image, arch, os_name)
        with self.assertRaisesRegex(ValueError, 'does not match'):
            self.check('sha256:' + '0' * 64)
        name = next(name for name in self.entries if name != 'manifest.json')
        self.entries[name] = b'{}'
        with self.assertRaisesRegex(ValueError, 'does not match'):
            self.check(image)

    def test_oci_each_hash_is_verified(self):
        manifest, config = self.manifest()
        image = self.index([self.platform(manifest)])
        original = self.entries.copy()
        for entry in (config, manifest, image):
            with self.subTest(media_type=entry['mediaType']):
                self.entries = original.copy()
                self.entries['blobs/sha256/' + entry['digest'].split(':')[1]] = b'{}'
                with self.assertRaisesRegex(ValueError, 'digest mismatch'):
                    self.check(image['digest'])

    def test_missing_blob_does_not_fall_back_to_legacy(self):
        manifest, config = self.manifest()
        self.classic()
        del self.entries['blobs/sha256/' + config['digest'].split(':')[1]]
        with self.assertRaisesRegex(ValueError, 'Missing'):
            self.check(manifest['digest'])

    def test_descriptor_platform_cannot_override_config(self):
        manifest, _ = self.manifest(dict(self.config, architecture='arm64'))
        image = self.index([self.platform(manifest)])
        with self.assertRaisesRegex(ValueError, 'config platform mismatch'):
            self.check(image['digest'])

    def test_ambiguous_or_absent_platform(self):
        manifest, _ = self.manifest()
        for entries in ([self.platform(manifest)] * 2, [self.platform(manifest, 'arm64')]):
            image = self.index(entries)
            with self.subTest(entries=entries), self.assertRaisesRegex(ValueError, 'platform'):
                self.check(image['digest'])

    def test_malformed_descriptors_fail_closed(self):
        manifest, _ = self.manifest()
        for field, value in [('digest', None), ('digest', 'sha512:' + '0' * 128),
                             ('size', None), ('size', True), ('size', -1),
                             ('size', manifest['size'] + 1), ('mediaType', CONFIG),
                             ('platform', 'linux/amd64')]:
            entry = self.platform(manifest)
            entry[field] = value
            image = self.index([entry])
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                self.check(image['digest'])

    def test_malformed_documents_fail_closed(self):
        for value in (None, [], {}, {'config': {'digest': 'sha256:' + '0' * 64}},
                      dict(self.config, schemaVersion=2), dict(self.config, rootfs={}),
                      {'schemaVersion': 1, 'mediaType': MANIFEST},
                      {'schemaVersion': 2, 'mediaType': 'application/json'},
                      {'schemaVersion': 2, 'mediaType': INDEX, 'manifests': {}},
                      {'schemaVersion': 2, 'mediaType': MANIFEST, 'config': {}, 'layers': []}):
            entry = self.add(value, CONFIG)
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.check(entry['digest'])

    def test_manifest_descriptor_type_and_size_mismatch(self):
        manifest, _ = self.manifest()
        entry = self.platform(manifest)
        entry['mediaType'] = INDEX
        image = self.index([entry])
        with self.assertRaisesRegex(ValueError, 'media type mismatch'):
            self.check(image['digest'])

    def test_excessive_nesting(self):
        entry, _ = self.manifest()
        for _ in range(4):
            entry = self.index([self.platform(entry)])
        with self.assertRaisesRegex(ValueError, 'nesting'):
            self.check(entry['digest'])

    def test_legacy_metadata_ambiguity_paths_and_missing(self):
        image = self.classic()
        for value in ([], [{}, {}], [{'Config': '../config.json'}],
                      [{'Config': '/config.json'}], [{'Config': 'missing.json'}], [{'Config': None}]):
            self.entries['manifest.json'] = json.dumps(value).encode()
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.check(image)

    def test_duplicate_archive_member_and_symlink(self):
        image = self.classic()
        duplicate = tarfile.TarInfo('manifest.json')
        duplicate.size = 2
        self.write(duplicate)
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            config_digest(self.archive, image, 'amd64', 'linux')
        del self.entries['manifest.json']
        link = tarfile.TarInfo('manifest.json')
        link.type = tarfile.SYMTYPE
        link.linkname = 'other.json'
        self.write(link)
        with self.assertRaisesRegex(ValueError, 'non-regular'):
            config_digest(self.archive, image, 'amd64', 'linux')

    def test_duplicate_json_fields(self):
        image = self.classic()
        self.entries['manifest.json'] = b'[{"Config":"one.json","Config":"two.json"}]'
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            self.check(image)

    def test_scan_binding(self):
        image = self.classic()
        expected = self.check(image)
        report = {'ArtifactType': 'container_image', 'Metadata': {'ImageID': expected}}
        verify_scan(report, expected)
        for value in (None, {}, {'ArtifactType': 'container_image', 'Metadata': {}},
                      dict(report, ArtifactType='filesystem'),
                      dict(report, Metadata={'ImageID': 'sha256:' + '0' * 64})):
            with self.subTest(report=value), self.assertRaisesRegex(ValueError, 'not bound'):
                verify_scan(value, expected)


if __name__ == '__main__':
    unittest.main()
