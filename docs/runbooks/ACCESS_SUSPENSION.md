# Buyer/supplier access suspension

Scope: IDN-011 and part of IDN-003/014. The routine control is for non-privileged buyer/supplier organizations and their members. MFA, privileged account suspension/recovery and permanent deactivation remain open; current-password confirmation is not MFA.

Platform administrators open **Account access controls** under administration. Organization and member lists use UUID cursors and return at most 50 rows. Select Review suspension/restoration, enter a reason of 10–1000 characters and confirm the current administrator password. Passwords are cleared after submission/cancellation, never added to audit metadata, and redacted by the logger if included in structured fields. Wrong confirmation returns REAUTHENTICATION_REQUIRED without logging the administrator out.

The server requires live platform `*` permission. Within the transaction it rechecks administrator activity, organization access/verification, password hash and session revocation/expiry. Routine controls reject the administrator's organization and any organization containing a platform-privileged account; this avoids accidental lockout but is not the eventual reviewed privileged suspension/recovery procedure.

Migration 032 adds `access_suspended_at` to organizations/users. This separates workspace access from independent supply trust/certification and from existing user active/deactivation state. Suspension does not change active, verification status, contract state, inventory custody, payment decisions or public trust labels.

Organization suspension revokes all member sessions and pending organization invitations. Member suspension revokes that member's sessions and leaves peers alone. Both changes and their audit/security events commit together. Identical retries return changed=false without duplicate audits. Session issuance locks the organization before its user; suspension locks that same organization so a new login cannot leave an unrevoked session after suspension commits. Invitation acceptance also locks organization before invitation. Password reset requests/consumption are denied while the user or organization is suspended; existing reset links otherwise keep their ordinary expiry and do not restore access flags.

Restoration clears only the selected suspension flag, never revives sessions or invitations, and never restores a separately suspended user. A member cannot be restored while its organization is suspended. Existing inactive users cannot be reactivated through this endpoint. New authentication still requires verified organization and active, non-suspended member. Users must sign in again; pending invitation recipients need a new invitation after organizational review. An organization with no enrolled administrator requires the separate platform re-enrollment/recovery procedure; restoration does not recreate its revoked first-admin invitation.

Already authorized in-flight requests may complete. This is a new-request access boundary, not retroactive cancellation of committed/in-progress business transactions. Public published supply is not withdrawn by suspension in this slice; listing moderation, provider suspension and operational recipient escalation remain separate product/security work. Investigate affected trades independently rather than silently transferring custody or cancelling payments.

Endpoints (platform administrators only):

- GET /admin/access-controls/organizations?after=UUID
- GET /admin/access-controls/users?organizationId=UUID&after=UUID
- POST /admin/access-controls/{organizations|users}/UUID with suspended boolean, reason, currentPassword

Cookie writes keep the normal trusted-Origin policy; explicit bearer clients keep authoritative credential selection. The decision route uses shared sensitive-action throttling. Audit actions: access.users.suspend/restore and access.organizations.suspend/restore. Failed password confirmation records access.reauthentication.failed with no password. Only administrators should access review reasons and member email lists.

Deploy additive migration before API startup; normal manifest-verified migration runner applies it. Do not manually restore revoked sessions or drop security columns. Rolling back to an older API removes access enforcement despite stored suspension flags; do not perform an old-API rollback under public exposure. Prefer forward correction, or stop/restrict external access while repairing. Frozen historical migrations and application volumes are preserved.

Automated coverage includes policy/input/reauthentication unit tests, seven PostgreSQL tests (scope, password, privileged protections, peers, invite/session restoration, concurrent retries/issuance and atomic rollback) and a real-account browser admin journey. Full native release, migration upgrade and recovery rehearsal must pass before merge. No long manual checklist is required for this slice.
