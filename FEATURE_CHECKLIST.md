# Atelier Chess — Feature MVP Checklist

Living checklist for the full ship. Update as slices land.

## Wave A — high leverage
- [x] 1. Phone as remote — `a46a015` (+ `d6308b2` game snapshot)
- [x] 2. Salon nights — `a46a015`
- [x] 3. Ghost league — `a46a015`
- [x] 4. Table skins / boards — `d5dc5b4` / `bf3ab5e`
- [x] 5. Spectator commentary — `f810623`

## Wave B — growth
- [ ] 6. Club rooms (persistent tables, invites, who's free)
- [ ] 7. Daily puzzle + streak
- [ ] 8. Coach whisper (post-game 3 bullets)
- [ ] 9. Challenge cards (OG/share images)
- [ ] 10. Kiosk mode v2 (locked local QR, guest join)

## Wave C — bigger bets
- [ ] 11. Local LAN table (or documented best-effort)
- [x] 12. Broadcast board / Tablecast — `decf0b4` (partial)
- [ ] 13. Variants café (Chess960 / antichess weekly)
- [ ] 14. Signed updates + auto-update UX
- [ ] 15. Atelier Pass soft (cosmetics flags, no pay-to-win)

## Notes
- Desktop-only lobby/play create; phone: `/join`, `/game`, `/watch`, `/handoff`, `/seat`, `/remote`, `/salon/[slug]`
- Commit/push conventional commits to master as batches land
- Avoid fighting Netlify cache/middleware hotfixes from parallel agents
