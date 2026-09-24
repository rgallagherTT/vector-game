/* ===================================================================
   SKY SKIFF — online settings
   Online play works on any static host (GitHub Pages included) the
   same way VECTOR does: a Supabase Realtime channel runs the lobby
   and introduces players, then the match itself runs peer-to-peer
   over WebRTC. Players whose network blocks WebRTC are relayed
   through Supabase instead, at a lower rate.

   The key below is Supabase's public "anon" client key — it is meant
   to ship in web pages. Sky Skiff shares VECTOR's project but uses
   its own channel names, so the two lobbies never mix. To move to a
   project of your own, swap supabaseUrl + supabaseKey.

   Self-hosting instead? `node server.js` serves the game and sets
   `server` automatically; nothing here needs changing.
   =================================================================== */
window.SKYSKIFF_ONLINE = Object.assign({
  supabaseUrl: 'https://ovikcgljthlkspzbxtov.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92aWtjZ2xqdGhsa3NwemJ4dG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDUyNTUsImV4cCI6MjA5MjI4MTI1NX0.VMxDeDseju-2vZqgqFYBsC5lLjvhZRW7LbWEQLwYj1o',
  channelPrefix: 'skyskiff',
  lib: 'js/vendor/supabase.js',
  stun: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'],
  queueSeconds: 30,          // matchmaking wait before drones fill the room
  relayHz: 6,                // send rate for players on the relay fallback
  rtc: true,                 // false = always use the relay (debugging)
  server: '',                // a wss:// URL here switches to a self-hosted server.js
  playUrl: 'https://rgallaghertt.github.io/vector-game/sky-skiff/'
}, window.SKYSKIFF_ONLINE || {});
