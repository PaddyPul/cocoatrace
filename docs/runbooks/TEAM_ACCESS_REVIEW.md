# Team access and privileged review

Organization administrators with member.manage use Team to inspect members, assign bounded buyer/supplier roles or deactivate another member. Confirm current password and a reason; fresh passkey assurance applies when required. Self changes, custom/wildcard targets and protected organizations are refused. Role changes revoke existing sessions and recovery/reset artifacts; deactivation also revokes passkeys. Restoration remains the separately reviewed access-control procedure. Management decisions refuse organizations above500 members; pages are server bounded. Invitation behavior is preserved.

Platform administrators use /access-review for a complete privileged roster (maximum500). Review reported findings and record an explanation. A receipt is bound to the observed snapshot; changed findings require reload and review. Next review is due in30 days. No retained session evidence means unknown activity, not proven inactivity. A recorded review does not resolve findings or certify access safe. Escalate findings through reviewed lifecycle controls. Receipts and audits are atomic; no edit/delete API exists.

Migrations039/040 are forward changes. Preserve existing Compose project, database and volumes. Normal startup applies migrations. Do not invoke npm in the hardened runtime or reset data. Roll back via reviewed forward correction; older images may reject a newer ledger.

Pending invitations sent by a changed member are revoked. Received invitation tokens remain subject to account-active/session issuance controls; they do not reactivate a deactivated account.
