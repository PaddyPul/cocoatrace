#!/usr/bin/env python3
"""Create VM-only secrets once; never print or replace existing credentials."""
import os
from pathlib import Path
import secrets
import stat
import sys


def main():
    if os.geteuid() != 0:
        sys.exit("Run with sudo -n python3 deploy/oracle-demo/configure.py")
    directory = Path("/etc/bettertrade")
    smtp = directory / "smtp.env"
    target = directory / "demo.env"
    if not smtp.is_file():
        sys.exit("Complete the Gmail SMTP authentication step first.")
    mode = smtp.stat()
    if mode.st_uid != 0 or stat.S_IMODE(mode.st_mode) != 0o600 or smtp.is_symlink():
        sys.exit("SMTP configuration must be a root-owned regular file with mode 600.")
    if target.exists():
        sys.exit("Demo configuration already exists. Existing secrets preserved.")
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(directory, 0o700)
    values = {name: secrets.token_hex(32) for name in (
        "DATABASE_PASSWORD", "JWT_SECRET", "INVITATION_DELIVERY_KEY",
        "EVIDENCE_UPLOAD_SIGNING_SECRET",
    )}
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as output:
        for name, value in values.items():
            output.write(f"{name}={value}\n")
    print("Demo secrets created privately. No application started.")


if __name__ == "__main__":
    main()
