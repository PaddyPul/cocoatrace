import importlib.util
import ast
import io
import json
import os
import stat
import sys
import tempfile
from pathlib import Path
import tarfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


recovery = load('recovery')
admin = load('admin-input')
# ci-recovery imports the same module by its standalone command name.
with patch.dict(sys.modules, {'recovery': recovery}):
    ci = load('ci-recovery')


def archive(entries):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w:gz') as writer:
        for name, value, kind in entries:
            entry = tarfile.TarInfo(name)
            entry.type = kind
            entry.size = len(value) if kind == tarfile.REGTYPE else 0
            entry.linkname = 'somewhere' if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE) else ''
            writer.addfile(entry, io.BytesIO(value) if kind == tarfile.REGTYPE else None)
    output.seek(0)
    return output


class RecoveryTests(unittest.TestCase):
    def test_containerd_index_is_accepted_only_for_matching_source_configuration(self):
        source = {'Image': 'sha256:' + 'a' * 64, 'Config': {'Image': 'release:old'}}
        image = 'sha256:' + 'b' * 64
        probe = 'c' * 64
        token = 'fixture'
        missing = SimpleNamespace(returncode=1, stdout=b'')
        available = SimpleNamespace(returncode=0, stdout=json.dumps([{'Id': image}]).encode())
        probe_details = {'Image': source['Image'], 'Config': {'Labels': {'bettertrade.image-probe': token}}}
        with patch.object(recovery.subprocess, 'run', side_effect=[missing, available]), \
             patch.object(recovery.secrets, 'token_hex', return_value=token), \
             patch.object(recovery, 'inspect', return_value=probe_details), \
             patch.object(recovery, 'run', side_effect=[probe.encode(), b'']) as command:
            self.assertEqual(recovery.local_source_image(source), image)
            arguments = command.call_args_list[0].args[0]
            self.assertIn('--pull=never', arguments)
            self.assertIn('--network=none', arguments)
            self.assertIn(image, arguments)
            self.assertEqual(command.call_args_list[-1].args[0], ['docker', 'rm', '-v', probe])

    def test_retagged_source_is_rejected_and_only_its_probe_is_removed(self):
        source = {'Image': 'sha256:' + 'a' * 64, 'Config': {'Image': 'release:old'}}
        probe = 'c' * 64
        available = SimpleNamespace(returncode=0, stdout=json.dumps([{'Id': 'sha256:' + 'b' * 64}]).encode())
        probe_details = {'Image': 'sha256:' + 'd' * 64, 'Config': {'Labels': {'bettertrade.image-probe': 'fixture'}}}
        with patch.object(recovery.subprocess, 'run', return_value=available), \
             patch.object(recovery.secrets, 'token_hex', return_value='fixture'), \
             patch.object(recovery, 'inspect', return_value=probe_details), \
             patch.object(recovery, 'run', side_effect=[probe.encode(), b'']) as command:
            with self.assertRaisesRegex(recovery.RecoveryError, 'no longer matches'):
                recovery.local_source_image(source)
            self.assertEqual(command.call_args_list[-1].args[0], ['docker', 'rm', '-v', probe])

    def test_missing_source_images_never_pull_or_start_substitutes(self):
        source = {'Image': 'sha256:' + 'a' * 64, 'Config': {'Image': 'release:old'}}
        with patch.object(recovery.subprocess, 'run', return_value=SimpleNamespace(returncode=1)), \
             patch.object(recovery, 'run') as command:
            with self.assertRaisesRegex(recovery.RecoveryError, 'unavailable locally'):
                recovery.local_source_image(source)
            command.assert_not_called()

    def test_probe_cleanup_refuses_a_different_label(self):
        source = {'Image': 'sha256:' + 'a' * 64, 'Config': {'Image': 'release:old'}}
        available = SimpleNamespace(returncode=0, stdout=json.dumps([{'Id': source['Image']}]).encode())
        with patch.object(recovery.subprocess, 'run', return_value=available), \
             patch.object(recovery, 'inspect', return_value={'Image': source['Image'], 'Config': {'Labels': {}}}), \
             patch.object(recovery, 'run', return_value=b'c' * 64) as command:
            with self.assertRaisesRegex(recovery.RecoveryError, 'label mismatch'):
                recovery.local_source_image(source)
            self.assertEqual(command.call_count, 1)

    def test_actual_oracle_config_and_index_ids_share_the_same_arm64_manifest(self):
        descriptor = {'mediaType': 'application/vnd.oci.image.manifest.v1+json',
            'digest': 'sha256:545207db085dedb1823e8d82b4a7cc4fe42aa4421951680f25644b0fe768e538',
            'platform': {'architecture': 'arm64', 'os': 'linux'}}
        source = {'Image': 'sha256:1be6154c14f5b476d8554e24df4a6ec474953292140535985d40ac7d08562ce1',
            'ImageManifestDescriptor': descriptor, 'Config': {'Image': 'release:old'}}
        image = 'sha256:639fddb7efb339359eef9506de05ff1a0870ac4e9c8941b2a69fe50ecea234ad'
        probe = {'Image': image, 'ImageManifestDescriptor': descriptor,
            'Config': {'Labels': {'bettertrade.image-probe': 'fixture'}}}
        missing = SimpleNamespace(returncode=1, stdout=b'')
        available = SimpleNamespace(returncode=0, stdout=json.dumps([{'Id': image}]).encode())
        with patch.object(recovery.subprocess, 'run', side_effect=[missing, available]), \
             patch.object(recovery.secrets, 'token_hex', return_value='fixture'), \
             patch.object(recovery, 'inspect', return_value=probe), \
             patch.object(recovery, 'run', side_effect=[b'c' * 64, b'']) as command:
            self.assertEqual(recovery.local_source_image(source), image)
            self.assertEqual(command.call_args_list[-1].args[0], ['docker', 'rm', '-v', 'c' * 64])

    def test_equal_image_ids_do_not_override_a_different_platform_manifest(self):
        descriptor = {'mediaType': 'application/vnd.oci.image.manifest.v1+json',
            'digest': 'sha256:' + 'a' * 64, 'platform': {'os': 'linux', 'architecture': 'arm64'}}
        source = {'Image': 'same-index', 'ImageManifestDescriptor': descriptor}
        for changes in ({'digest': 'sha256:' + 'b' * 64},
                        {'platform': {'os': 'linux', 'architecture': 'amd64'}},
                        {'platform': {'os': 'linux', 'architecture': 'arm64', 'variant': 'v9'}},
                        {'digest': 'invalid'}, {'mediaType': 'application/vnd.oci.image.index.v1+json'}):
            with self.subTest(changes=changes):
                probe = {'Image': 'same-index', 'ImageManifestDescriptor': {**descriptor, **changes}}
                self.assertFalse(recovery.same_source_image(source, probe))

    def test_missing_or_malformed_platform_metadata_cannot_downgrade_identity(self):
        descriptor = {'mediaType': 'application/vnd.oci.image.manifest.v1+json',
            'digest': 'sha256:' + 'a' * 64, 'platform': {'os': 'linux', 'architecture': 'arm64'}}
        source = {'Image': 'same-id', 'ImageManifestDescriptor': descriptor}
        for candidate in (None, {}, [], {**descriptor, 'platform': {}},
                          {**descriptor, 'platform': {'os': 'linux', 'architecture': 64}}):
            with self.subTest(candidate=candidate):
                self.assertFalse(recovery.same_source_image(source,
                    {'Image': 'same-id', 'ImageManifestDescriptor': candidate}))
        self.assertFalse(recovery.same_source_image({'Image': 'same-id'}, source))

    def test_legacy_image_identity_requires_equal_ids_when_both_descriptors_are_absent(self):
        self.assertTrue(recovery.same_source_image({'Image': 'same'}, {'Image': 'same'}))
        self.assertFalse(recovery.same_source_image({'Image': 'old'}, {'Image': 'new'}))

    def test_host_python_modules_parse(self):
        for source in ROOT.glob('*.py'):
            ast.parse(source.read_text())

    def test_evidence_byte_changes_are_detected_without_storing_payloads(self):
        first = recovery.evidence_index(archive([('./objects/document', b'first', tarfile.REGTYPE)]))
        changed = recovery.evidence_index(archive([('./objects/document', b'other', tarfile.REGTYPE)]))
        self.assertNotEqual(first, changed)
        self.assertEqual(first['objects/document']['bytes'], 5)
        self.assertNotIn('first', str(first))

    def test_archive_paths_links_and_duplicate_files_are_rejected(self):
        for name, kind in [('/absolute', tarfile.REGTYPE), ('../escape', tarfile.REGTYPE),
                           ('objects/../../escape', tarfile.REGTYPE), ('objects\\escape', tarfile.REGTYPE),
                           ('link', tarfile.SYMTYPE), ('hardlink', tarfile.LNKTYPE), ('device', tarfile.CHRTYPE)]:
            with self.subTest(name=name, kind=kind), self.assertRaises(recovery.RecoveryError):
                recovery.evidence_index(archive([(name, b'x', kind)]))
        with self.assertRaises(recovery.RecoveryError):
            recovery.evidence_index(archive([('object', b'x', tarfile.REGTYPE), ('./object', b'y', tarfile.REGTYPE)]))

    def test_snapshot_refuses_running_writers_before_any_dump_or_file_write(self):
        with patch.object(recovery, 'safe_directory', return_value=Path('/nonexistent/snapshot')), \
             patch.object(recovery, 'inspect', return_value={'State': {'Running': True}}), \
             patch.object(recovery, 'run') as execute:
            with self.assertRaisesRegex(recovery.RecoveryError, 'Stop API and web'):
                recovery.snapshot(Path('/nonexistent/snapshot'))
            execute.assert_not_called()

    def test_control_characters_and_placeholders_are_rejected_without_mutation(self):
        self.assertIsNone(admin.validate('owner@example.test', 'unique-été-password-4827!'))
        self.assertIn('control', admin.validate('owner@example.test', '\x1b[200~long-password-input'))
        self.assertIn('Email', admin.validate('bad', 'unique-long-password-4827!'))
        self.assertIn('72', admin.validate('owner@example.test', 'é' * 40))
        self.assertIn('unique', admin.validate('owner@example.test', 'change-me-before-demo-4827!'))

    def test_admin_rejects_path_arguments_before_reading_credentials(self):
        for destination in ('../../escape', '/etc/passwd', 'credentials.json'):
            with self.subTest(destination=destination), patch.object(sys, 'argv', ['admin-input.py', destination]), \
                 patch('builtins.open') as opened, patch.object(admin.getpass, 'getpass') as prompt:
                with self.assertRaises(SystemExit):
                    admin.main()
                opened.assert_not_called()
                prompt.assert_not_called()

    def test_admin_refuses_terminal_or_pipe_output_before_prompting(self):
        for mode in (stat.S_IFIFO | 0o600, stat.S_IFCHR | 0o600, stat.S_IFREG | 0o644):
            with self.subTest(mode=mode), patch.object(sys, 'argv', ['admin-input.py']), \
                 patch.object(admin.os, 'fstat', return_value=SimpleNamespace(st_mode=mode, st_uid=0)), \
                 patch.object(admin.getpass, 'getpass') as prompt:
                with self.assertRaises(SystemExit):
                    admin.main()
                prompt.assert_not_called()

    def test_email_validation_is_bounded_and_rejects_ambiguous_addresses(self):
        for address in ('a@b..test', 'a@@b.test', '@b.test', 'a@b', 'a b@c.test', 'a' * 100000 + '@b.test'):
            with self.subTest(address=address[:40]):
                self.assertFalse(admin.valid_email(address))
        self.assertTrue(admin.valid_email('owner+demo@example.test'))

    def test_ci_report_names_cannot_escape_and_reports_remain_private(self):
        with tempfile.TemporaryDirectory() as temporary:
            previous = Path.cwd()
            previous_mask = os.umask(0o077)
            try:
                os.chdir(temporary)
                backups = Path('backups')
                reports = backups / 'rehearsals'
                reports.mkdir(parents=True)
                (reports / 'input.json').write_text(json.dumps({'status': 'passed', 'name': '../../escaped'}))
                ci.publish_reports(backups, True)
                output = Path('hosted-recovery-test-results')
                self.assertEqual({item.name for item in output.iterdir()}, {'positive.json', 'summary.json'})
                self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o700)
                for item in output.iterdir():
                    self.assertEqual(stat.S_IMODE(item.stat().st_mode), 0o600)
                self.assertFalse(Path('escaped').exists())
            finally:
                os.chdir(previous)
                os.umask(previous_mask)

    def test_ci_artifact_directory_cannot_follow_a_preexisting_symlink(self):
        with tempfile.TemporaryDirectory() as temporary:
            previous = Path.cwd()
            try:
                os.chdir(temporary)
                Path('outside').mkdir()
                Path('hosted-recovery-test-results').symlink_to('outside', target_is_directory=True)
                with self.assertRaises(FileExistsError):
                    ci.publish_reports(Path('unused'), True)
                self.assertEqual(list(Path('outside').iterdir()), [])
            finally:
                os.chdir(previous)


if __name__ == '__main__':
    unittest.main()
