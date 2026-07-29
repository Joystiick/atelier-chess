# Atelier Chess — Feature MVP Checklist

Living checklist for the full ship. Update as slices land.

## Wave A — high leverage
- [x] 1. Phone as remote (clocks, draw/resign, chat/emotes, QR handoff)
- [x] 2. Salon nights (scheduled themed tables)
- [x] 3. Ghost league (seasonal soft ladder from ghost rematch)
- [x] 4. Table skins / boards (wood/marble/café cloth free packs)
- [x] 5. Spectator commentary (watch reactions + sparse move feed)
- [x] **Tablecast P0** (desktop table + phone seats + live gallery; spectator Pusher auth)

## Wave B — growth
- [x] 6. Club rooms (persistent tables, invites, who’s free)
- [x] 7. Daily puzzle + streak
- [x] 8. Coach whisper (post-game 3 bullets)
- [x] 9. Challenge cards (OG/share images)
- [x] 10. Kiosk mode v2 (locked local QR, guest join)

## Wave C — bigger bets
- [x] 11. Local LAN table (QR + sparse cloud polling; documented best-effort — not WebRTC)
- [x] 12. Broadcast board (`/watch/CODE?overlay=1` or `/broadcast/CODE` OBS overlay)
- [x] 13. Variants café (Chess960 / antichess weekly special)
- [x] 14. Signed updates + auto-update UX (soft-fail + docs; signing when certs exist)
- [x] 15. Atelier Pass soft (cosmetics flags, Stripe-ready hooks, no pay-to-win)

## Notes
- Desktop-only lobby/play create; phone: `/join`, `/game`, `/watch`, `/handoff`, `/seat`, `/kiosk/join`
- Tablecast: Open from lobby or WaitingRoom; rematch keeps `tablecast`; gallery uses Pusher (read-only)
- LAN party: `lanMode` create + badge; QR seat claim; cloud moves with sparse polling (not WebRTC)
- OBS overlay: `/watch/CODE?overlay=1` (alias `?broadcast=1`) or `/broadcast/CODE`; hides starfield
- Variants café: weekly Chess960 ↔ antichess; unrated; antichess = soft capture-mandatory
- Desktop updater: soft messaging; certs/signing blocked until Authenticode / Developer ID
- Atelier Pass: `users.atelier_pass` + cosmetics; Settings preview unlock; Stripe env hooks only
- Clubs: invite `?invite=1`, open table code, presence “who’s free”
- Puzzle: calendar-day streak in localStorage; miss a day resets
- Coach whisper: heuristic bullets on GameOverOverlay (no engine dump)
- Challenge: `/challenge/[username]/opengraph-image`
- Kiosk: lock booth + guest seat tokens; guest games unrated
- Commit/push conventional commits to master as batches land
- Avoid fighting Netlify cache/middleware hotfixes from parallel agents
