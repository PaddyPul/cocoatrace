#!/usr/bin/env python3
"""Collect credentials before launching Docker; never print the password."""
import getpass
import json
import os
import stat
import re
import sys


def valid_email(email):
    # Bounded, linear checks; no ambiguous quantified regex or backtracking.
    if not isinstance(email, str) or len(email) > 254 or any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in email):
        return False
    parts = email.split('@')
    if len(parts) != 2 or not parts[0] or len(parts[0]) > 64:
        return False
    labels = parts[1].split('.')
    return len(labels) >= 2 and all(labels)


def validate(email, password):
    if not valid_email(email):
        return "Email address is invalid."
    if not isinstance(password, str):
        return "Password must be text."
    if any(ord(c) < 32 or ord(c) == 127 for c in password):
        return "Password contains terminal control characters. Paste as plain text or type it; it has not been altered."
    if len(password.encode("utf-16-le")) // 2 < 20 or len(password.encode("utf-8")) > 72:
        return "Password must contain at least 20 characters and at most 72 UTF-8 bytes."
    if re.search(r"password123|change.?me", password, re.IGNORECASE):
        return "Choose a unique password without Password123 or change-me."
    return None


def main():
    if len(sys.argv) != 1:
        sys.exit("This command accepts no arguments; credentials use private standard output.")
    destination = os.fstat(sys.stdout.fileno())
    if os.geteuid() != 0 or not stat.S_ISREG(destination.st_mode) or destination.st_uid != 0 or stat.S_IMODE(destination.st_mode) != 0o600:
        sys.exit("Credentials require a root-owned mode-600 regular output file; terminal and pipe output are refused.")
    for _ in range(3):
        # All prompts use the terminal, not stdout/stdin used for secret transport.
        with open("/dev/tty", "r+") as terminal:
            terminal.write("Administrator email: ")
            terminal.flush()
            email = terminal.readline().strip()
        password = getpass.getpass("New BetterTrade password (hidden): ")
        error = validate(email, password)
        if error:
            print(error, file=sys.stderr)
            continue
        confirmation = getpass.getpass("Repeat BetterTrade password (hidden): ")
        if password != confirmation:
            print("Passwords differ. No account was created; try again.", file=sys.stderr)
            continue
        json.dump({"email": email, "password": password}, sys.stdout)
        print("Input checked. Creating the private administrator.", file=sys.stderr)
        return
    sys.exit("Input was not accepted after three attempts. No bootstrap command was submitted.")


if __name__ == "__main__":
    main()
