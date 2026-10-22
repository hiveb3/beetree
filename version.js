/* BeeTris releases, newest first.
   The first entry is the current version shown in the game. To ship a new version, add an entry at the top,
   then run `node scripts/changelog.js` to regenerate CHANGELOG.md.
   Versioning: vMAJOR.MINOR.PATCH. New features bump MINOR, bug fixes bump PATCH; v1.0.0 marks the end of beta. */
window.HBP_RELEASES = [
  {
    version: '0.11.0',
    date: '2026-10-20',
    notes: [
      'Phone controls redesigned as one symmetric deck: two thumb clusters of the same size, set in from the edges.',
      'Left thumb: a wide hard-drop bar above two big Left and Right keys. Right thumb: a big clockwise rotate, with counter-clockwise above and soft drop below on the inner side.',
      'Spare screen height now goes to bigger keys instead of an empty band under the board.',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-10-20',
    notes: [
      'Phone controls rearranged: the left thumb moves and drops (Left and Right side by side, the hard drop centered above them with a clear gap), the right thumb rotates (big clockwise, small counter-clockwise at its upper left, a slim soft drop below).',
      'Every phone button now has a touch area of at least 44 by 44 pixels.',
      'Visit counts now group game overs by lines cleared and are ready for versus and Hive login events.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-10-20',
    notes: [
      'Consensus Seal reworked: when it lands it is used up and clears the top three rows of your stack, wherever you put it.',
      'Stronger flag bomb: it blasts the 3×3 area where it lands and clears those three columns all the way to the top.',
      'Records now show the game version of each run.',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-10-20',
    notes: [
      'Phone controls rebuilt for the thumbs: a big clockwise rotate in the middle of a left-hand cross (move beside it, soft drop below, small counter-clockwise above), and only the hard drop on the right.',
      'Clearer specials: the flag bomb now clears its whole column, the Consensus Seal shows x/10 counters on every row it would touch, each special explains itself the first time, and the bee button lights up when you can afford one.',
      'On-screen goals (lines to the next hardfork, your best), no accidental restart right after a game over, a turn-your-phone notice, and groundwork for versus play and Hive login.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-10-14',
    notes: [
      'Phone controls regrouped by hand: rotate and move on the left, soft and hard drop on the right.',
      'Everything fits one screen: the home page switches between Play, Rules, Controls, Records and Version tabs, and long lists swipe sideways instead of scrolling.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-10-13',
    notes: [
      'New rare piece: the Consensus Seal, an H-shaped block from HF26 that fills and clears rows that are at least 70% full.',
      'Original 8-bit background music that speeds up with each hardfork, with its own on/off switch (N key) separate from sound effects (M key).',
      'Version number and this changelog in the home page footer.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-10-10',
    notes: [
      'Moved to its own repository and a new address: d-bot-2026.github.io/hive-block-producer.',
      'Search engine verification and updated share links for the new address.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-10-09',
    notes: [
      'Public launch: search engines may index the site, with share previews for LINE, Threads and Hive.',
      'New-player warm-up (slower pieces until the first clear) and a 10-second controls hint.',
      'Unofficial fan project notice.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-10-08',
    notes: [
      'Renamed to Hive Block Producer, with a home page, guest nickname and top-10 records on this device.',
      'Eight languages, English by default, and a notice that in-game HIVE, HBD and RC have no real value.',
      'Cookie-free visit counting with GoatCounter.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-10-07',
    notes: [
      'Phone controls split into a square move pad and round rotate keys to avoid mis-taps.',
      'Chinese and English interface.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-10-07',
    notes: [
      'First playable build: a Hive-themed block puzzle with HIVE and HBD tokens, Resource Credits, worker bees and flag bombs.',
      'Hardfork eras every 10 lines and random chain events such as whale upvotes, downvotes and airdrops.',
    ],
  },
];
