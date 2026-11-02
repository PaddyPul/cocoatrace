#!/usr/bin/env python3
"""Collect credentials before launching Docker; never print the password."""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import sys


def validate(email, password):
    if not isinstance(email, str) or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
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
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
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
        descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as output:
            json.dump({"email": email, "password": password}, output)
        print("Input checked. Creating the private administrator.")
        return
    sys.exit("Input was not accepted after three attempts. No bootstrap command was submitted.")


if __name__ == "__main__":
    main()
