import importlib.util
import ast
import io
from pathlib import Path
import tarfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


recovery = load('recovery')
admin = load('admin-input')


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


if __name__ == '__main__':
    unittest.main()
