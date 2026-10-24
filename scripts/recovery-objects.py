"""Disposable Moto-only object recovery rehearsal; never accepts a real endpoint."""
import hashlib
import io
import os
import stat
from pathlib import Path
import json
import sys
import tarfile
import boto3
from botocore.exceptions import ClientError

SOURCE = 'cocoatrace-recovery-source'
TARGET = 'cocoatrace-recovery-restored'
KEY = 'evidence/recovery-test/document'
DELETED = 'evidence/recovery-test/deleted'
CURRENT = b'%PDF-1.4\nRECOVERY REHEARSAL ONLY current evidence\n%%EOF\n'
OLD = b'%PDF-1.4\nRECOVERY REHEARSAL ONLY prior evidence\n%%EOF\n'
WORKSPACE = Path(os.environ['RECOVERY_WORKSPACE'])
workspace_stat = WORKSPACE.lstat()
if (not stat.S_ISDIR(workspace_stat.st_mode) or workspace_stat.st_uid != os.geteuid()
        or stat.S_IMODE(workspace_stat.st_mode) != 0o700):
    raise ValueError('Recovery workspace must be an owned private directory')
ARCHIVE = WORKSPACE / 'private-evidence.tar'
VERSION_MAP = WORKSPACE / 'restored-version-map.json'
s3 = boto3.client('s3', endpoint_url='http://127.0.0.1:5000', region_name='us-east-1',
                  aws_access_key_id='recovery_test', aws_secret_access_key='recovery_test')

def setup(bucket):
    s3.create_bucket(Bucket=bucket, ACL='private')
    s3.put_bucket_versioning(Bucket=bucket, VersioningConfiguration={'Status': 'Enabled'})
    s3.put_public_access_block(Bucket=bucket, PublicAccessBlockConfiguration={
        'BlockPublicAcls': True, 'IgnorePublicAcls': True,
        'BlockPublicPolicy': True, 'RestrictPublicBuckets': True})
    s3.put_bucket_encryption(Bucket=bucket, ServerSideEncryptionConfiguration={
        'Rules': [{'ApplyServerSideEncryptionByDefault': {'SSEAlgorithm': 'AES256'}}]})

def inventory(bucket):
    response = s3.list_object_versions(Bucket=bucket)
    assert not response.get('IsTruncated'), 'Recovery inventory must not truncate'
    rows = response.get('Versions', []) + response.get('DeleteMarkers', [])
    assert len(rows) <= 100, 'Disposable recovery inventory exceeded budget'
    return rows

def archive_source():
    entries = []
    with tarfile.open(ARCHIVE, 'w') as archive:
        rows = inventory(SOURCE)
        # ListObjectVersions returns newest first; second-resolution timestamps can tie.
        ordered = list(reversed([r for r in rows if not r['IsLatest']])) + [r for r in rows if r['IsLatest']]
        for index, row in enumerate(ordered):
            entry = {'key': row['Key'], 'sourceVersion': row['VersionId'],
                     'latest': row['IsLatest'], 'deleted': 'Size' not in row}
            if not entry['deleted']:
                obj = s3.get_object(Bucket=SOURCE, Key=row['Key'], VersionId=row['VersionId'])
                content = obj['Body'].read(65537)
                assert len(content) <= 65536, 'Disposable object exceeded budget'
                entry.update(file=str(index), size=len(content), sha256=hashlib.sha256(content).hexdigest(),
                             contentType=obj['ContentType'])
                info = tarfile.TarInfo(str(index))
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
            entries.append(entry)
        manifest = json.dumps(entries).encode()
        info = tarfile.TarInfo('manifest.json')
        info.size = len(manifest)
        archive.addfile(info, io.BytesIO(manifest))
    assert len(entries) == 4, 'Expected two live versions and one deleted version plus marker'

def restore():
    # Rebuild a separate bucket. Original version IDs cannot be preserved by S3 PUT;
    # retain an explicit original-to-restored mapping and verify every mapped version.
    setup(TARGET)
    mapping = []
    with tarfile.open(ARCHIVE) as archive:
        entries = json.load(archive.extractfile('manifest.json'))
        for entry in entries:
            if entry['deleted']:
                result = s3.delete_object(Bucket=TARGET, Key=entry['key'])
            else:
                content = archive.extractfile(entry['file']).read()
                assert hashlib.sha256(content).hexdigest() == entry['sha256'], 'Archive checksum differs'
                assert len(content) == entry['size'], 'Archive size differs'
                result = s3.put_object(Bucket=TARGET, Key=entry['key'], Body=content,
                                      ContentType=entry['contentType'], ServerSideEncryption='AES256', ACL='private')
            mapping.append({**entry, 'restoredVersion': result['VersionId']})
    with open(VERSION_MAP, 'w') as output:
        json.dump(mapping, output)

def verify():
    with open(VERSION_MAP) as source:
        mapping = json.load(source)
    rows = inventory(TARGET)
    assert len(rows) == len(mapping), 'Restored version count differs'
    for entry in mapping:
        matching = [r for r in rows if r['Key'] == entry['key'] and r['VersionId'] == entry['restoredVersion']]
        assert len(matching) == 1 and matching[0]['IsLatest'] == entry['latest'], 'Version/head mapping differs'
        assert ('Size' not in matching[0]) == entry['deleted'], 'Delete-marker identity differs'
        if not entry['deleted']:
            obj = s3.get_object(Bucket=TARGET, Key=entry['key'], VersionId=entry['restoredVersion'])
            content = obj['Body'].read()
            assert hashlib.sha256(content).hexdigest() == entry['sha256'], 'Restored checksum differs'
            assert len(content) == entry['size'] and obj['ContentType'] == entry['contentType'], 'Restored metadata differs'
            assert obj['ServerSideEncryption'] == 'AES256', 'Encryption missing'
            grants = s3.get_object_acl(Bucket=TARGET, Key=entry['key'], VersionId=entry['restoredVersion'])['Grants']
            assert all('URI' not in grant['Grantee'] for grant in grants), 'Public object grant'
    assert s3.get_object(Bucket=TARGET, Key=KEY)['Body'].read() == CURRENT, 'Current head differs'
    try:
        s3.get_object(Bucket=TARGET, Key=DELETED)
        raise AssertionError('Deleted object resurrected')
    except ClientError as error:
        assert error.response['Error']['Code'] in ('NoSuchKey', '404')
    controls = s3.get_public_access_block(Bucket=TARGET)['PublicAccessBlockConfiguration']
    assert all(controls.values()), 'Public access block missing'

def expect_failure():
    try:
        verify()
    except AssertionError:
        return
    raise AssertionError('Damaged recovery incorrectly passed')

phase = sys.argv[1]
if phase == 'prepare':
    setup(SOURCE)
    s3.put_object(Bucket=SOURCE, Key=KEY, Body=OLD, ContentType='application/pdf')
    s3.put_object(Bucket=SOURCE, Key=KEY, Body=CURRENT, ContentType='application/pdf')
    s3.put_object(Bucket=SOURCE, Key=DELETED, Body=OLD, ContentType='application/pdf')
    s3.delete_object(Bucket=SOURCE, Key=DELETED)
    archive_source()
    # Remove all original bytes/versions before restore; no accidental live-source reads.
    rows = inventory(SOURCE)
    s3.delete_objects(Bucket=SOURCE, Delete={'Objects': [{'Key': r['Key'], 'VersionId': r['VersionId']} for r in rows]})
    s3.delete_bucket(Bucket=SOURCE)
    print('PASS: versioned evidence archived; original bucket and all versions removed')
elif phase == 'restore':
    restore()
    verify()
    # Canary: additional corrupt head and missing historical version must fail closed.
    bad = s3.put_object(Bucket=TARGET, Key=KEY, Body=b'corrupt')
    expect_failure()
    s3.delete_object(Bucket=TARGET, Key=KEY, VersionId=bad['VersionId'])
    with open(VERSION_MAP) as source:
        old = next(e for e in json.load(source) if e['key'] == KEY and not e['latest'])
    s3.delete_object(Bucket=TARGET, Key=KEY, VersionId=old['restoredVersion'])
    expect_failure()
    # Restore cleanly for the final relational/metadata cross-check.
    rows = inventory(TARGET)
    s3.delete_objects(Bucket=TARGET, Delete={'Objects': [{'Key': r['Key'], 'VersionId': r['VersionId']} for r in rows]})
    s3.delete_bucket(Bucket=TARGET)
    restore()
    verify()
    print('PASS: private bytes, both versions, delete marker, checksums, MIME, encryption and version mapping restored; corruption/missing-version canaries rejected')
elif phase == 'verify':
    verify()
    metadata = json.loads(sys.argv[2])
    def verify_database(record):
        obj = s3.get_object(Bucket=TARGET, Key=record['storageKey'])
        content = obj['Body'].read()
        assert hashlib.sha256(content).hexdigest() == record['sha256'], 'Database/object checksum mismatch'
        assert len(content) == record['size'], 'Database/object size mismatch'
        assert obj['ContentType'] == record['mimeType'], 'Database/object MIME mismatch'
    verify_database(metadata)
    for field, value in [('sha256', '0' * 64), ('size', -1), ('mimeType', 'application/incorrect')]:
        try:
            verify_database({**metadata, field: value})
        except AssertionError:
            continue
        raise AssertionError('Mismatched database metadata incorrectly passed')
    print('PASS: restored object head matches restored database metadata; hash/size/MIME mismatch canaries rejected')
else:
    raise ValueError('Unknown disposable recovery phase')
