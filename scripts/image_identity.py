"""Bind scanner config identity to the immutable Docker/OCI artifact exported."""
import hashlib
import json
import re
import tarfile


def config_digest(archive, image_id, architecture, operating_system):
    with tarfile.open(archive) as tar:
        def blob(digest):
            if not re.fullmatch(r'sha256:[0-9a-f]{64}', digest):
                raise ValueError('Unsupported image digest')
            stream = tar.extractfile('blobs/sha256/' + digest.split(':')[1])
            if stream is None:
                raise ValueError('Missing image blob')
            data = stream.read()
            if 'sha256:' + hashlib.sha256(data).hexdigest() != digest:
                raise ValueError('Image blob digest mismatch')
            return json.loads(data)

        # Docker's classic store identifies images by config hash; the newer
        # containerd store identifies them by an OCI manifest or index hash.
        try:
            document = blob(image_id)
        except KeyError:
            manifest = json.load(tar.extractfile('manifest.json'))
            if len(manifest) != 1:
                raise ValueError('Ambiguous legacy image archive')
            data = tar.extractfile(manifest[0]['Config']).read()
            if 'sha256:' + hashlib.sha256(data).hexdigest() != image_id:
                raise ValueError('Legacy archive does not match requested image')
            document = json.loads(data)
        for _ in range(4):
            if 'manifests' in document:
                matches = [entry for entry in document['manifests']
                           if entry.get('platform', {}).get('architecture') == architecture
                           and entry.get('platform', {}).get('os') == operating_system]
                if len(matches) != 1:
                    raise ValueError('Ambiguous or missing platform manifest')
                document = blob(matches[0]['digest'])
            elif 'config' in document:
                digest = document['config']['digest']
                config = blob(digest)
                if config.get('architecture') != architecture or config.get('os') != operating_system:
                    raise ValueError('Image config platform mismatch')
                return digest
            else:
                if document.get('architecture') != architecture or document.get('os') != operating_system:
                    raise ValueError('Legacy image config platform mismatch')
                return image_id
        raise ValueError('Excessive image manifest nesting')


if __name__ == '__main__':
    import subprocess
    import sys
    report_path, archive, image_id = sys.argv[1:]
    inspected = json.loads(subprocess.check_output(['docker', 'image', 'inspect', image_id]))[0]
    if inspected['Id'] != image_id:
        raise ValueError('Docker image identity mismatch')
    expected = config_digest(archive, image_id, inspected['Architecture'], inspected['Os'])
    with open(report_path) as stream:
        scanned = json.load(stream)['Metadata']['ImageID']
    if scanned != expected:
        raise ValueError('Scanned image config is not bound to requested artifact')
    print('PASS: scanned config digest is bound to immutable image through verified archive hashes')
