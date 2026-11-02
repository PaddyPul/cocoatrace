#!/usr/bin/env python3
"""Consistent demo snapshots and isolated restores. No production restore command."""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import time

BACKUP_ROOT = Path('/var/backups/bettertrade')
PREFIX = 'bettertrade-investor-demo-'


class RecoveryError(Exception):
    pass


def run(arguments, **options):
    result = subprocess.run(arguments, stderr=subprocess.DEVNULL,
                            stdout=options.pop('stdout', subprocess.PIPE), **options)
    if result.returncode:
        raise RecoveryError('A recovery command failed; live volumes were not restored or deleted.')
    return result.stdout


def inspect(container):
    return json.loads(run(['docker', 'inspect', container]))[0]


def digest_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def evidence_index(source):
    """Validate paths/types before extraction; hash bytes without buffering files."""
    entries = {}
    with tarfile.open(fileobj=source, mode='r|*') as archive:
        for member in archive:
            name = member.name
            while name.startswith('./'):
                name = name[2:]
            if member.isdir() and name in ('', '.'):
                continue
            path = PurePosixPath(name)
            if not name or path.is_absolute() or '..' in path.parts or '\\' in name:
                raise RecoveryError('Unsafe evidence archive path.')
            if not member.isdir() and not member.isfile():
                raise RecoveryError('Evidence archives cannot contain links or special files.')
            if member.isdir():
                continue
            normalized = str(path)
            if normalized in entries:
                raise RecoveryError('Duplicate evidence archive path.')
            if len(entries) >= 100000:
                raise RecoveryError('Evidence archive exceeds the rehearsal file limit.')
            digest = hashlib.sha256()
            stream = archive.extractfile(member)
            if stream is None:
                raise RecoveryError('Evidence bytes are missing.')
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
            entries[normalized] = {'bytes': member.size, 'sha256': digest.hexdigest()}
    return dict(sorted(entries.items()))


def volume_index(image, volume):
    process = subprocess.Popen(['docker', 'run', '--rm', '--pull=never', '--network=none',
        '--mount', f'type=volume,src={volume},dst=/evidence,readonly', '--entrypoint', 'tar',
        image, '-C', '/evidence', '-cf', '-', '.'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        if process.stdout is None:
            raise RecoveryError('Evidence verification stream is missing.')
        index = evidence_index(process.stdout)
        if process.wait() != 0:
            raise RecoveryError('Evidence verification command failed.')
        return index
    finally:
        if process.stdout:
            process.stdout.close()
        if process.poll() is None:
            process.kill()
            process.wait()


def query(container, sql):
    return run(['docker', 'exec', '-e', 'PGOPTIONS=-c timezone=UTC', container,
                'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'bettertrade',
                '-d', 'bettertrade_demo', '-At', '-c', sql]).decode().strip()


def stream_hash(arguments, ignore_dump_headers=False):
    digest = hashlib.sha256()
    process = subprocess.Popen(arguments, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    assert process.stdout is not None
    try:
        if ignore_dump_headers:
            for line in process.stdout:
                # pg_dump's per-invocation restriction token is deliberately random.
                if not line.startswith((b'--', b'\\restrict ', b'\\unrestrict ')):
                    digest.update(line)
        else:
            for chunk in iter(lambda: process.stdout.read(1024 * 1024), b''):
                digest.update(chunk)
        if process.wait() != 0:
            raise RecoveryError('Database fingerprint failed.')
    finally:
        process.stdout.close()
        if process.poll() is None:
            process.kill()
            process.wait()
    return digest.hexdigest()


def identifier(name):
    return '"' + name.replace('"', '""') + '"'


def database_index(container):
    names = json.loads(query(container,
        "SELECT coalesce(json_agg(tablename ORDER BY tablename),'[]'::json) "
        "FROM pg_catalog.pg_tables WHERE schemaname='public'"))
    tables = {}
    for name in names:
        sql = f'COPY (SELECT row_to_json(t)::text FROM public.{identifier(name)} t ORDER BY row_to_json(t)::text) TO STDOUT'
        tables[name] = stream_hash(['docker', 'exec', '-e', 'PGOPTIONS=-c timezone=UTC', container,
            'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'bettertrade', '-d', 'bettertrade_demo', '-c', sql])
    sequence_names = json.loads(query(container,
        "SELECT coalesce(json_agg(sequencename ORDER BY sequencename),'[]'::json) "
        "FROM pg_catalog.pg_sequences WHERE schemaname='public'"))
    sequences = {name: json.loads(query(container,
        f'SELECT row_to_json(s)::text FROM (SELECT last_value,is_called FROM public.{identifier(name)}) s'))
        for name in sequence_names}
    schema = stream_hash(['docker', 'exec', container, 'pg_dump', '-U', 'bettertrade',
        '-d', 'bettertrade_demo', '--schema-only', '--no-owner', '--no-privileges'], True)
    return {'schemaSha256': schema, 'tables': tables, 'sequences': sequences}


def safe_directory(path):
    # Never accept arbitrary caller paths, symlinks or non-private snapshots.
    absolute = Path(os.path.abspath(path))
    if BACKUP_ROOT.is_symlink() or absolute.parent != BACKUP_ROOT or absolute.is_symlink() or not absolute.is_dir():
        raise RecoveryError('Choose a snapshot directory directly under /var/backups/bettertrade.')
    for entry in (BACKUP_ROOT, absolute):
        details = entry.stat()
        if details.st_uid != 0 or stat.S_IMODE(details.st_mode) != 0o700:
            raise RecoveryError('Snapshot directories must be root-owned with mode 700.')
    return absolute


def snapshot(directory):
    directory = safe_directory(directory)
    if any((directory / name).exists() for name in ('database.dump', 'evidence.tar.gz', 'recovery.json')):
        raise RecoveryError('Snapshot output exists; it was preserved.')
    # This command cannot take a misleading metadata-only snapshot while writers run.
    api = inspect(PREFIX + 'api-1')
    web = inspect(PREFIX + 'web-1')
    if api['State']['Running'] or web['State']['Running']:
        raise RecoveryError('Stop API and web writers under maintenance before snapshotting.')
    database = inspect(PREFIX + 'postgres-1')
    if not database['State']['Running']:
        raise RecoveryError('Source database is not running.')
    mounts = [mount for mount in api['Mounts']
              if mount['Destination'] == '/app/private-evidence' and mount['Type'] == 'volume']
    if len(mounts) != 1:
        raise RecoveryError('Expected one private evidence volume.')
    with open(directory / 'database.dump', 'xb') as output:
        run(['docker', 'exec', database['Id'], 'pg_dump', '-U', 'bettertrade',
             '-d', 'bettertrade_demo', '--format=custom'], stdout=output)
    with open(directory / 'evidence.tar.gz', 'xb') as output:
        run(['docker', 'run', '--rm', '--pull=never', '--network=none',
             '--mount', f"type=volume,src={mounts[0]['Name']},dst=/evidence,readonly",
             '--entrypoint', 'tar', api['Image'], '-C', '/evidence', '-czf', '-', '.'], stdout=output)
    with open(directory / 'evidence.tar.gz', 'rb') as source:
        evidence = evidence_index(source)
    record = {
        'schemaVersion': 1,
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'release': Path('/etc/bettertrade/active-release').read_text().strip(),
        'postgresImage': database['Image'], 'apiImage': api['Image'],
        'database': database_index(database['Id']), 'evidence': evidence,
        'files': {name: digest_file(directory / name)
                  for name in ('database.dump', 'evidence.tar.gz', 'demo.env', 'smtp.env', 'Caddyfile')},
    }
    if not re.fullmatch(r'[a-f0-9]{40}', record['release']):
        raise RecoveryError('Source release marker is invalid.')
    # Written last: missing metadata means an incomplete, unusable checkpoint.
    (directory / 'recovery.json').write_text(json.dumps(record, indent=2) + '\n')
    print(f'Complete database and evidence snapshot: {directory}')


def verify(directory):
    directory = safe_directory(directory)
    manifest = directory / 'recovery.json'
    if not manifest.is_file() or manifest.is_symlink():
        raise RecoveryError('Snapshot is incomplete; create a fresh complete checkpoint.')
    if manifest.stat().st_uid != 0 or stat.S_IMODE(manifest.stat().st_mode) != 0o600:
        raise RecoveryError('Snapshot manifest must be a root-only regular file.')
    record = json.loads(manifest.read_text())
    if not re.fullmatch(r'[a-f0-9]{40}', record.get('release', '')):
        raise RecoveryError('Snapshot source release is invalid.')
    if record.get('schemaVersion') != 1 or set(record.get('files', {})) != {
        'database.dump', 'evidence.tar.gz', 'demo.env', 'smtp.env', 'Caddyfile'
    }:
        raise RecoveryError('Snapshot manifest is missing or invalid; create a fresh snapshot.')
    for name, expected in record['files'].items():
        item = directory / name
        if (item.is_symlink() or not item.is_file() or item.stat().st_uid != 0
                or stat.S_IMODE(item.stat().st_mode) != 0o600 or digest_file(item) != expected):
            raise RecoveryError('Snapshot integrity check failed; no restore started.')
    for image in ('postgresImage', 'apiImage'):
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', record[image]):
            raise RecoveryError('Snapshot image identity is invalid.')
        run(['docker', 'image', 'inspect', record[image]])
    with open(directory / 'evidence.tar.gz', 'rb') as source:
        if evidence_index(source) != record['evidence']:
            raise RecoveryError('Evidence index does not match the archive.')
    if shutil.disk_usage('/var/lib/docker').free < 8 * 1024 * 1024 * 1024:
        raise RecoveryError('At least 8 GiB free disk required for the isolated restore.')

    token = secrets.token_hex(12)
    container = 'bt-restore-' + token
    volumes = [container + '-database', container + '-evidence']
    label = 'bettertrade.rehearsal=' + token
    reports = BACKUP_ROOT / 'rehearsals'
    reports.mkdir(mode=0o700, exist_ok=True)
    report_path = reports / (container + '.json')
    report = {'schemaVersion': 1, 'status': 'failed', 'sourceRelease': record['release'],
              'snapshot': directory.name, 'startedAt': datetime.now(timezone.utc).isoformat(),
              'databaseVerified': False, 'evidenceVerified': False, 'cleanupComplete': False,
              'evidenceFiles': len(record['evidence']),
              'evidenceBytes': sum(entry['bytes'] for entry in record['evidence'].values()),
              'nonEmptyEvidenceVerified': False}
    temporary = Path(tempfile.mkdtemp(prefix='bt-restore-', dir='/etc/bettertrade'))
    created_volumes = []
    created_container = False
    stage = 'isolated resources'
    try:
        for volume in volumes:
            exists = subprocess.run(['docker', 'volume', 'inspect', volume], stdout=subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL)
            if exists.returncode == 0:
                raise RecoveryError('Refusing to reuse an existing rehearsal volume.')
            run(['docker', 'volume', 'create', '--label', label, volume])
            created_volumes.append(volume)
        env = temporary / 'postgres.env'
        env.write_text('POSTGRES_DB=bettertrade_demo\nPOSTGRES_USER=bettertrade\nPOSTGRES_PASSWORD=' + secrets.token_hex(32) + '\n')
        os.chmod(env, 0o600)
        run(['docker', 'create', '--name', container, '--label', label, '--pull=never',
             '--network=none', '--memory=512m', '--cpus=1', '--env-file', str(env),
             '--mount', f'type=volume,src={volumes[0]},dst=/var/lib/postgresql/data', record['postgresImage']])
        created_container = True
        run(['docker', 'start', container])
        isolation = inspect(container)['HostConfig']
        if isolation['NetworkMode'] != 'none' or isolation.get('PortBindings'):
            raise RecoveryError('Rehearsal database must have no network or published ports.')
        for _ in range(60):
            ready = subprocess.run(['docker', 'exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'bettertrade', '-d', 'bettertrade_demo'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if ready.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RecoveryError('Isolated database did not become ready.')
        stage = 'database restore and logical verification'
        with open(directory / 'database.dump', 'rb') as source:
            run(['docker', 'exec', '-i', container, 'pg_restore', '--clean', '--if-exists', '--exit-on-error', '-U', 'bettertrade',
                 '-d', 'bettertrade_demo'], stdin=source)
        if database_index(container) != record['database']:
            raise RecoveryError('Restored database schema, rows or sequence state differ.')
        report['databaseVerified'] = True
        stage = 'evidence restore and byte verification'
        with open(directory / 'evidence.tar.gz', 'rb') as source:
            run(['docker', 'run', '--rm', '-i', '--pull=never', '--network=none', '--user=0:0',
                 '--mount', f'type=volume,src={volumes[1]},dst=/evidence', '--entrypoint', 'tar',
                 record['apiImage'], '-C', '/evidence', '-xzf', '-'], stdin=source)
        if volume_index(record['apiImage'], volumes[1]) != record['evidence']:
            raise RecoveryError('Restored evidence bytes differ.')
        report['evidenceVerified'] = True
        report['nonEmptyEvidenceVerified'] = bool(record['evidence'])
        report['status'] = 'passed'
    except Exception:
        report['failedStage'] = stage
    finally:
        cleanup_ok = True
        if created_container:
            try:
                details = inspect(container)
                if details['Config']['Labels'].get('bettertrade.rehearsal') != token:
                    raise RecoveryError('Rehearsal cleanup label mismatch.')
                run(['docker', 'rm', '-f', container])
            except Exception:
                cleanup_ok = False
        for volume in created_volumes:
            try:
                details = json.loads(run(['docker', 'volume', 'inspect', volume]))[0]
                if details['Labels'].get('bettertrade.rehearsal') != token:
                    raise RecoveryError('Rehearsal cleanup label mismatch.')
                run(['docker', 'volume', 'rm', volume])
            except Exception:
                cleanup_ok = False
        shutil.rmtree(temporary)
        report['cleanupComplete'] = cleanup_ok
        if not cleanup_ok:
            report['status'] = 'failed'
            report['cleanupResources'] = [container, *created_volumes]
        report['finishedAt'] = datetime.now(timezone.utc).isoformat()
        report_path.write_text(json.dumps(report, indent=2) + '\n')
    print(f"Restore rehearsal {report['status']}. Report: {report_path}")
    if report['status'] == 'passed' and not report['nonEmptyEvidenceVerified']:
        print('Evidence volume was empty. Non-empty document recovery remains unverified.')
    if report['status'] != 'passed':
        raise RecoveryError('Rehearsal failed. Inspect its redacted report; live data was not replaced.')


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('operation', choices=['snapshot', 'verify'])
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    if os.geteuid() != 0:
        sys.exit('Run recovery maintenance with sudo -n python3.')
    lock = None
    if args.operation == 'verify':
        lock = open('/run/lock/bettertrade-demo-deploy.lock', 'a')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    try:
        snapshot(args.directory) if args.operation == 'snapshot' else verify(args.directory)
    finally:
        if lock:
            lock.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, RecoveryError) else
              'Recovery operation could not complete. Check private snapshot integrity, Docker and the maintenance lock.', file=sys.stderr)
        sys.exit(1)
