#!/usr/bin/env python3
"""GitHub-hosted disposable fixture only; never run against an existing VM install."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import time

import recovery


def main():
    os.umask(0o077)
    if os.geteuid() != 0 or os.environ.get('GITHUB_ACTIONS') != 'true' or not os.environ.get('GITHUB_RUN_ID', '').isdigit():
        sys.exit('This fixture is restricted to an ephemeral GitHub Actions runner.')
    config = Path('/etc/bettertrade')
    backups = recovery.BACKUP_ROOT
    if config.exists() or backups.exists():
        sys.exit('Refusing an existing BetterTrade installation or backup directory.')
    names = [recovery.PREFIX + name + '-1' for name in ('postgres', 'api', 'web')]
    for name in names:
        if subprocess.run(['docker', 'inspect', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            sys.exit('Refusing an existing BetterTrade container.')
    token = secrets.token_hex(12)
    label = 'bettertrade.ci-recovery=' + token
    volumes = ['bt-ci-recovery-' + token + suffix for suffix in ('-db', '-evidence')]
    created = []
    created_volumes = []
    config.mkdir(mode=0o700)
    backups.mkdir(mode=0o700, parents=True)
    fixture_passed = False
    try:
        recovery.run(['docker', 'pull', 'postgres:16-alpine'])
        image = json.loads(recovery.run(['docker', 'image', 'inspect', 'postgres:16-alpine']))[0]['Id']
        for volume in volumes:
            recovery.run(['docker', 'volume', 'create', '--label', label, volume])
            created_volumes.append(volume)
        env = config / 'fixture.env'
        env.write_text('POSTGRES_DB=bettertrade_demo\nPOSTGRES_USER=bettertrade\nPOSTGRES_PASSWORD=' + secrets.token_hex(32) + '\n')
        recovery.run(['docker', 'run', '-d', '--name', names[0], '--label', label, '--network=none',
                      '--env-file', str(env), '--mount', f'type=volume,src={volumes[0]},dst=/var/lib/postgresql/data', image])
        created.append(names[0])
        for _ in range(60):
            if subprocess.run(['docker', 'exec', names[0], 'pg_isready', '-h', '127.0.0.1', '-U', 'bettertrade'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                break
            time.sleep(1)
        else:
            raise recovery.RecoveryError('CI source database did not become ready.')
        recovery.query(names[0], "CREATE TABLE fixture_users(id SERIAL PRIMARY KEY,email TEXT NOT NULL); "
                       "INSERT INTO fixture_users(email) VALUES('synthetic@example.test'); "
                       "CREATE TABLE fixture_trades(id SERIAL PRIMARY KEY,user_id INT REFERENCES fixture_users(id),quantity NUMERIC(12,3)); "
                       "INSERT INTO fixture_trades(user_id,quantity) VALUES(1,123.456)")
        recovery.run(['docker', 'run', '--rm', '--network=none', '--mount', f'type=volume,src={volumes[1]},dst=/evidence',
                      '--entrypoint', 'sh', image, '-c', 'mkdir -p /evidence/objects; printf "synthetic evidence bytes\\n" > /evidence/objects/document'])
        for name in names[1:]:
            args = ['docker', 'run', '-d', '--name', name, '--label', label, '--network=none']
            if name == names[1]:
                args += ['--mount', f'type=volume,src={volumes[1]},dst=/app/private-evidence']
            recovery.run([*args, '--entrypoint', 'sleep', image, '3600'])
            created.append(name)
        recovery.run(['docker', 'stop', *names[1:]])
        source_before = recovery.database_index(names[0])
        (config / 'active-release').write_text('a' * 40 + '\n')
        directory = backups / ('ci-' + token)
        directory.mkdir(mode=0o700)
        for name in ('demo.env', 'smtp.env', 'Caddyfile'):
            (directory / name).write_text('synthetic fixture only\n')
        recovery.snapshot(directory)
        recovery.verify(directory)
        reports = list((backups / 'rehearsals').glob('*.json'))
        report = json.loads(reports[0].read_text())
        if report['status'] != 'passed' or not report['nonEmptyEvidenceVerified'] or not report['cleanupComplete']:
            raise recovery.RecoveryError('CI positive restore verification failed.')

        # An integrity failure must be caught before creating any restore resources.
        dump = directory / 'database.dump'
        dump.write_bytes(b'invalid archive')
        try:
            recovery.verify(directory)
        except recovery.RecoveryError:
            pass
        else:
            raise recovery.RecoveryError('Corrupt backup was not rejected.')
        # Even when the checksum is updated, pg_restore failure must clean its isolated resources.
        manifest_path = directory / 'recovery.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['files']['database.dump'] = hashlib.sha256(dump.read_bytes()).hexdigest()
        manifest_path.write_text(json.dumps(manifest))
        try:
            recovery.verify(directory)
        except recovery.RecoveryError:
            pass
        else:
            raise recovery.RecoveryError('Invalid database archive was accepted.')
        failed_reports = [json.loads(item.read_text()) for item in (backups / 'rehearsals').glob('*.json')]
        if not any(item['status'] == 'failed' and item['cleanupComplete'] for item in failed_reports):
            raise recovery.RecoveryError('CI failed-restore cleanup was not proven.')
        if recovery.database_index(names[0]) != source_before:
            raise recovery.RecoveryError('CI live source changed during rehearsal.')
        if recovery.volume_index(image, volumes[1]) != manifest['evidence']:
            raise recovery.RecoveryError('CI source evidence changed during rehearsal.')
        fixture_passed = True
        print('CI restore passed: schema, rows, sequences and non-empty evidence bytes; corruption rejected; failure cleanup and source preservation verified.')
    finally:
        output = Path('hosted-recovery-test-results')
        output.mkdir(mode=0o755, exist_ok=True)
        os.chmod(output, 0o755)
        reports = backups / 'rehearsals'
        if reports.is_dir():
            for report in reports.glob('*.json'):
                target = output / report.name
                details = json.loads(report.read_text())
                details['expectedStatus'] = 'failed' if details.get('failedStage') == 'database restore and logical verification' else 'passed'
                target.write_text(json.dumps(details, indent=2) + '\n')
                os.chmod(target, 0o644)
        summary = output / 'summary.json'
        summary.write_text(json.dumps({'status': 'passed' if fixture_passed else 'failed',
            'negativeRestoreCaseExpected': True, 'scope': 'disposable synthetic CI fixture only'}) + '\n')
        os.chmod(summary, 0o644)
        for name in created:
            if recovery.inspect(name)['Config']['Labels'].get('bettertrade.ci-recovery') == token:
                recovery.run(['docker', 'rm', '-f', name])
        for volume in created_volumes:
            details = json.loads(recovery.run(['docker', 'volume', 'inspect', volume]))[0]
            if details['Labels'].get('bettertrade.ci-recovery') == token:
                recovery.run(['docker', 'volume', 'rm', volume])
        # Only directories exclusively created by this fixture are removed.
        shutil.rmtree(config)
        shutil.rmtree(backups)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, recovery.RecoveryError) else
              'Disposable CI recovery fixture failed; no existing BetterTrade install was used.', file=sys.stderr)
        sys.exit(1)
