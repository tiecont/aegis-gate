"""Bind scanner config identity to the immutable Docker/OCI artifact exported."""
import hashlib
import gzip
import json
from pathlib import PurePosixPath
import re
import tarfile


INDEX_TYPES = {'application/vnd.oci.image.index.v1+json',
               'application/vnd.docker.distribution.manifest.list.v2+json'}
MANIFEST_TYPES = {'application/vnd.oci.image.manifest.v1+json',
                  'application/vnd.docker.distribution.manifest.v2+json'}
CONFIG_TYPES = {'application/vnd.oci.image.config.v1+json',
                'application/vnd.docker.container.image.v1+json'}
MAX_METADATA_SIZE = 16 * 1024 * 1024
MAX_LAYER_SIZE = 2 * 1024 * 1024 * 1024
LAYER_TYPES = {'application/vnd.oci.image.layer.v1.tar': 'plain',
               'application/vnd.oci.image.layer.v1.tar+gzip': 'gzip',
               'application/vnd.docker.image.rootfs.diff.tar': 'plain',
               'application/vnd.docker.image.rootfs.diff.tar.gzip': 'gzip'}


def require_digest(digest):
    if not isinstance(digest, str) or not re.fullmatch(r'sha256:[0-9a-f]{64}', digest):
        raise ValueError('Unsupported image digest')
    return digest


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate image metadata field')
        result[key] = value
    return result


def descriptor(value, media_types):
    if not isinstance(value, dict) or value.get('mediaType') not in media_types:
        raise ValueError('Unsupported image descriptor type')
    require_digest(value.get('digest'))
    if type(value.get('size')) is not int or value['size'] < 0:
        raise ValueError('Invalid image descriptor size')
    return value


def config_digest(archive, image_id, architecture, operating_system, variant=''):
    require_digest(image_id)
    if not all(isinstance(value, str) and value for value in (architecture, operating_system)):
        raise ValueError('Invalid expected image platform')
    if not isinstance(variant, str):
        raise ValueError('Invalid expected image variant')
    with tarfile.open(archive) as tar:
        members = {}
        for member in tar.getmembers():
            if member.name in members:
                raise ValueError('Duplicate image archive member')
            members[member.name] = member

        def member_for(name):
            path = PurePosixPath(name) if isinstance(name, str) else None
            if path is None or path.is_absolute() or '..' in path.parts or str(path) != name:
                raise ValueError('Invalid image metadata path')
            member = members.get(name)
            if member is None or not member.isfile():
                raise ValueError('Missing or non-regular image metadata')
            return member

        def read(name):
            member = member_for(name)
            if member.size > MAX_METADATA_SIZE:
                raise ValueError('Excessive image metadata size')
            with tar.extractfile(member) as stream:
                return stream.read()

        def document(data):
            return json.loads(data, object_pairs_hook=unique_object)

        def blob(digest, expected_size=None):
            require_digest(digest)
            data = read('blobs/sha256/' + digest.split(':')[1])
            if 'sha256:' + hashlib.sha256(data).hexdigest() != digest:
                raise ValueError('Image blob digest mismatch')
            if expected_size is not None and len(data) != expected_size:
                raise ValueError('Image descriptor size mismatch')
            return document(data)

        def stream_digest(stream):
            digest = hashlib.sha256()
            size = 0
            while chunk := stream.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_LAYER_SIZE:
                    raise ValueError('Excessive image layer size')
                digest.update(chunk)
            return 'sha256:' + digest.hexdigest()

        def layer(name, diff_id, entry=None):
            member = member_for(name)
            if member.size > MAX_LAYER_SIZE:
                raise ValueError('Excessive image layer size')
            with tar.extractfile(member) as stream:
                if entry is not None:
                    if member.size != entry['size']:
                        raise ValueError('Image layer descriptor size mismatch')
                    if stream_digest(stream) != entry['digest']:
                        raise ValueError('Image layer digest mismatch')
                    stream.seek(0)
                    compression = LAYER_TYPES[entry['mediaType']]
                else:
                    compression = 'gzip' if stream.read(2) == b'\x1f\x8b' else 'plain'
                    stream.seek(0)
                if compression == 'gzip':
                    with gzip.GzipFile(fileobj=stream) as unpacked:
                        actual = stream_digest(unpacked)
                else:
                    actual = stream_digest(stream)
                if actual != diff_id:
                    raise ValueError('Image layer does not match ordered config diff IDs')

        legacy = None
        if 'manifest.json' in members:
            legacy = document(read('manifest.json'))
            if not isinstance(legacy, list) or len(legacy) != 1 or not isinstance(legacy[0], dict):
                raise ValueError('Ambiguous legacy image archive')
            legacy = legacy[0]

        root_path = 'blobs/sha256/' + image_id.split(':')[1]
        if root_path in members:
            current = blob(image_id)
        elif ('index.json' in members
              and 'sha256:' + hashlib.sha256(read('index.json')).hexdigest() == image_id):
            current = document(read('index.json'))
        else:
            if legacy is None:
                raise ValueError('Missing image archive root')
            data = read(legacy.get('Config'))
            if 'sha256:' + hashlib.sha256(data).hexdigest() != image_id:
                raise ValueError('Legacy archive does not match requested image')
            current = document(data)

        digest = image_id
        expected_type = None
        layers = None
        if 'index.json' in members:
            data = read('index.json')
            index = document(data)
            if (not isinstance(index, dict) or type(index.get('schemaVersion')) is not int
                    or index['schemaVersion'] != 2
                    or ('mediaType' in index and index['mediaType'] not in INDEX_TYPES)
                    or not isinstance(index.get('manifests'), list) or len(index['manifests']) != 1):
                raise ValueError('Ambiguous OCI archive entry point')
            entry = descriptor(index['manifests'][0], INDEX_TYPES | MANIFEST_TYPES)
            if 'platform' in entry:
                platform = entry['platform']
                if (not isinstance(platform, dict) or platform.get('architecture') != architecture
                        or platform.get('os') != operating_system or platform.get('variant', '') != variant):
                    raise ValueError('OCI archive entry point platform mismatch')
            manifest = blob(entry['digest'], entry['size'])
            if 'sha256:' + hashlib.sha256(data).hexdigest() == image_id:
                current = index
                expected_type = 'application/vnd.oci.image.index.v1+json'
            elif entry['digest'] == image_id:
                current = manifest
                expected_type = entry['mediaType']
            elif (isinstance(manifest, dict) and isinstance(manifest.get('config'), dict)
                  and manifest['config'].get('digest') == image_id):
                # Docker save names the archive by config ID while index.json
                # points to the schema-2 manifest ID. Bind both identities.
                current = manifest
                digest = entry['digest']
                expected_type = entry['mediaType']
            else:
                raise ValueError('OCI archive entry point does not match requested image')
        for _ in range(4):
            if not isinstance(current, dict):
                raise ValueError('Invalid image metadata document')
            media_type = current.get('mediaType')
            if 'mediaType' in current and not isinstance(media_type, str):
                raise ValueError('Invalid image metadata type')
            # OCI document mediaType is optional; descriptors supply the type.
            # A directly addressed root has no descriptor, so schema/structure
            # must identify one unambiguous schema-2 document kind.
            if media_type is None and current.get('schemaVersion') == 2:
                if expected_type in INDEX_TYPES | MANIFEST_TYPES:
                    media_type = expected_type
                elif expected_type is None:
                    if 'manifests' in current and 'config' not in current and 'layers' not in current:
                        media_type = 'application/vnd.oci.image.index.v1+json'
                    elif 'config' in current and 'layers' in current and 'manifests' not in current:
                        media_type = 'application/vnd.oci.image.manifest.v1+json'
            # Image configs have their own runtime "config" object (Env/Cmd),
            # not the config descriptor found in schema-2 image manifests.
            if expected_type in CONFIG_TYPES or (expected_type is None and media_type is None):
                if ('manifests' in current or 'schemaVersion' in current or media_type is not None
                        or not isinstance(current.get('config'), dict)
                        or not isinstance(current.get('rootfs'), dict)
                        or current['rootfs'].get('type') != 'layers'
                        or not isinstance(current['rootfs'].get('diff_ids'), list)):
                    raise ValueError('Invalid image config document')
                for diff_id in current['rootfs']['diff_ids']:
                    require_digest(diff_id)
                if (current.get('architecture') != architecture or current.get('os') != operating_system
                        or current.get('variant', '') != variant):
                    raise ValueError('Image config platform mismatch')
                diff_ids = current['rootfs']['diff_ids']
                if layers is not None:
                    if len(layers) != len(diff_ids):
                        raise ValueError('Image layer/config count mismatch')
                    for entry, diff_id in zip(layers, diff_ids):
                        descriptor(entry, LAYER_TYPES)
                        layer('blobs/sha256/' + entry['digest'].split(':')[1], diff_id, entry)
                elif legacy is None:
                    raise ValueError('Missing image layer inventory')
                if legacy is not None:
                    data = read(legacy.get('Config'))
                    if 'sha256:' + hashlib.sha256(data).hexdigest() != digest:
                        raise ValueError('Legacy config differs from requested image')
                    names = legacy.get('Layers')
                    if not isinstance(names, list) or len(names) != len(diff_ids):
                        raise ValueError('Legacy image layer/config count mismatch')
                    for name, diff_id in zip(names, diff_ids):
                        layer(name, diff_id)
                return digest
            if expected_type is not None and media_type != expected_type:
                raise ValueError('Image descriptor media type mismatch')
            if type(current.get('schemaVersion')) is not int or current['schemaVersion'] != 2:
                raise ValueError('Unsupported image metadata schema')
            if media_type in INDEX_TYPES:
                entries = current.get('manifests')
                if not isinstance(entries, list) or not entries or 'config' in current:
                    raise ValueError('Invalid image index')
                matches = []
                for entry in entries:
                    descriptor(entry, INDEX_TYPES | MANIFEST_TYPES)
                    platform = entry.get('platform', {})
                    if not isinstance(platform, dict):
                        raise ValueError('Invalid image platform descriptor')
                    if (platform.get('architecture') == architecture and platform.get('os') == operating_system
                            and platform.get('variant', '') == variant):
                        matches.append(entry)
                if len(matches) != 1:
                    raise ValueError('Ambiguous or missing platform manifest')
                selected = matches[0]
            elif media_type in MANIFEST_TYPES:
                if 'manifests' in current or not isinstance(current.get('layers'), list):
                    raise ValueError('Invalid image manifest')
                selected = descriptor(current.get('config'), CONFIG_TYPES)
                layers = current['layers']
            else:
                raise ValueError('Unsupported image metadata type')
            digest = selected['digest']
            expected_type = selected['mediaType']
            current = blob(digest, selected['size'])
        raise ValueError('Excessive image manifest nesting')


def verify_scan(report, expected):
    require_digest(expected)
    if (not isinstance(report, dict) or report.get('ArtifactType') != 'container_image'
            or not isinstance(report.get('Metadata'), dict)
            or report['Metadata'].get('ImageID') != expected):
        raise ValueError('Scanned image config is not bound to requested artifact')


if __name__ == '__main__':
    import subprocess
    import sys
    report_path, archive, image_id = sys.argv[1:]
    inspected = json.loads(subprocess.check_output(['docker', 'image', 'inspect', image_id]))[0]
    if inspected['Id'] != image_id:
        raise ValueError('Docker image identity mismatch')
    expected = config_digest(archive, image_id, inspected['Architecture'], inspected['Os'], inspected.get('Variant', ''))
    with open(report_path) as stream:
        verify_scan(json.load(stream, object_pairs_hook=unique_object), expected)
    print('PASS: scanned config digest is bound to immutable image through verified archive hashes')
