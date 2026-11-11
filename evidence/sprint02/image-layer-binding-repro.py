"""Independent archive-substitution regression; only temporary owned artifacts."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tarfile
import tempfile


validator = Path(sys.argv[1]).resolve()
spec = importlib.util.spec_from_file_location('reviewed_image_identity', validator)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
digest = lambda data: 'sha256:' + hashlib.sha256(data).hexdigest()
print('validator_sha256=' + hashlib.sha256(validator.read_bytes()).hexdigest())
layer_stream = io.BytesIO()
with tarfile.open(fileobj=layer_stream, mode='w') as tar:
    data = b'owned original artifact content\n'
    member = tarfile.TarInfo('artifact.txt')
    member.size = len(data)
    tar.addfile(member, io.BytesIO(data))
layer = layer_stream.getvalue()
config = json.dumps({'architecture': 'amd64', 'os': 'linux', 'config': {},
                     'rootfs': {'type': 'layers', 'diff_ids': [digest(layer)]}}).encode()
image_id = digest(config)
config_type = 'application/vnd.oci.image.config.v1+json'
manifest_type = 'application/vnd.oci.image.manifest.v1+json'
layer_type = 'application/vnd.oci.image.layer.v1.tar'
oci_manifest = json.dumps({'schemaVersion': 2, 'mediaType': manifest_type,
    'config': {'mediaType': config_type, 'size': len(config), 'digest': image_id},
    'layers': [{'mediaType': layer_type, 'size': len(layer), 'digest': digest(layer)}]}).encode()
blob_path = lambda value: 'blobs/sha256/' + digest(value).split(':')[1]
archives = {
    'classic': (image_id, {image_id.split(':')[1] + '.json': config,
        'manifest.json': json.dumps([{'Config': image_id.split(':')[1] + '.json',
                                      'RepoTags': [], 'Layers': ['layer.tar']}]).encode(),
        'layer.tar': layer}, 'layer.tar'),
    'oci': (digest(oci_manifest), {blob_path(config): config,
        blob_path(oci_manifest): oci_manifest, blob_path(layer): layer,
        'oci-layout': b'{"imageLayoutVersion":"1.0.0"}',
        'index.json': json.dumps({'schemaVersion': 2,
            'mediaType': 'application/vnd.oci.image.index.v1+json', 'manifests': [
            {'mediaType': manifest_type, 'size': len(oci_manifest),
             'digest': digest(oci_manifest),
             'platform': {'architecture': 'amd64', 'os': 'linux'}}]}).encode()}, blob_path(layer)),
}
failed = 0
with tempfile.TemporaryDirectory(prefix='aegisgate-review-') as directory:
    archive = Path(directory) / 'artifact.tar'
    for format_name, (identity, entries, layer_name) in archives.items():
        for substituted in (False, True):
            with tarfile.open(archive, 'w') as tar:
                for name, content in entries.items():
                    if substituted and name == layer_name:
                        content = content.replace(b'original', b'modified')
                    member = tarfile.TarInfo(name)
                    member.size = len(content)
                    tar.addfile(member, io.BytesIO(content))
            try:
                actual = module.config_digest(archive, identity, 'amd64', 'linux')
                module.verify_scan({'ArtifactType': 'container_image',
                                    'Metadata': {'ImageID': image_id}}, actual)
                accepted = True
            except (ValueError, KeyError, TypeError, tarfile.TarError) as error:
                accepted = False
                print(f'{format_name} substituted={substituted} rejected={type(error).__name__}: {error}')
            expected = not substituted
            outcome = 'PASS' if accepted == expected else 'FAIL'
            print(f'{outcome} {format_name} substituted={substituted} accepted={accepted}')
            failed += accepted != expected
sys.exit(1 if failed else 0)
