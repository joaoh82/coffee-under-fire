# Admin activity reports

The owner console at `/admin` includes independent player and successful-login searches by invite ID, guest ID or current display name. Search is a literal, case-insensitive substring. Both tables use 25-row pages with totals and previous/next navigation. Players sort by last login or measured play time, ascending or descending; IDs resolve ties. Players without logins appear last when sorting by login. Successful logins sort newest first.

The activity report covers the last 7, 30 or 90 UTC days, including the current partial day. Search filters affect tables only, not analytics.

| Metric | Definition |
| --- | --- |
| Daily active players | Distinct invite/browser identities with positive measured play time in games started that day. |
| New players | Identities whose first successful login was that day. Unused invites are not new players. |
| Average daily play time | Measured play minutes divided by that day's active identities. The period summary is weighted by active identity-days. |
| Estimated Jev spending | Stored charged or reserved costs by usage day, including unresolved reservations. Not a provider invoice. |
| Game starts | Sessions started that day, including sessions with no measured play time. |
| Player identities | All stored invited and guest identities, including unused invites. |

Play time comes from capped heartbeats for visible, running games. It does not verify attention or unique humans. Paused and hidden-tab time is excluded. Sessions and their accumulated play time are assigned to the session's UTC start day because historical per-day heartbeat records do not exist. Games crossing midnight therefore belong to their start day. Billing migration dates can also be approximate for old records. These limitations matter when quoting the figures publicly.

Owner-only `/admin/report.csv?days=30` exports zero-filled daily aggregate rows without names, IDs, IP identifiers or credentials. It uses the same metric definitions as the charts. Review the definitions when sharing CSVs. No analytics data is exposed to player cookies or anonymous visitors.

Existing data is preserved. Deployment adds indexes only; no credentials or configuration changes are needed. The queries read the existing persistent SQLite database. No third-party analytics scripts or chart dependencies are used.

Validation: production build; 133 tests, including pagination beyond 200 players, Unicode and literal search, stable sorting, revocation, distinct-user calculations, UTC boundaries, zero days, reserved costs, escaped filters, and CSV access control. Browser checks use synthetic in-memory data, not production traffic.
