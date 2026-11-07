/* ============================================================
   ECHOES OF THE FALLEN — quests, dialogue, lore
   ============================================================ */

const M = (map, x, y) => ({ map, x: x * 16, y: y * 16 });

export const QUESTS = {
  main: {
    id: 'main', name: 'Echoes Awaken', type: 'main', giver: 'maelin',
    desc: 'The three Echo Monuments have fallen silent, and the world is forgetting its own shape. Elder Maelin believes you can still hear them. Find the monuments, wake them, and learn what waits beneath the Sanctuary.',
    steps: [
      { id: 'start', text: 'Speak with Elder Maelin in the Sanctuary', done: g => g.flags.mainStarted, marker: M('sanctuary', 34, 20) },
      { id: 'root', text: 'Awaken the Root Monument in Greenfall Forest', done: g => g.flags['monument:greenfall'], marker: M('greenfall', 108, 13) },
      { id: 'crown', text: 'Awaken the Crown Monument in the Forgotten Kingdom', done: g => g.flags['monument:kingdom'], marker: M('kingdom', 68, 22) },
      { id: 'peak', text: 'Awaken the Peak Monument in Frostbound Mountains', done: g => g.flags['monument:frost'], marker: M('frost', 92, 12) },
      { id: 'return', text: 'Return to Elder Maelin at the Sanctuary', done: g => g.flags.mainReturned, marker: M('sanctuary', 34, 20) },
      { id: 'depths', text: 'Descend into the Sunken Depths', done: g => g.flags.enteredDepths, marker: M('sanctuary', 25, 23) },
      { id: 'chorus', text: 'Silence the Deep Chorus beneath the world', done: g => g.flags['boss:chorus'], marker: M('depths', 60, 84) },
      { id: 'heart', text: 'Touch the Heart of the Echo', done: g => g.flags.endingSeen, marker: M('depths', 60, 90) },
    ],
    rewards: { xp: 600, gold: 300, shards: 4, skillPoints: 2 },
  },
  locket: {
    id: 'locket', name: 'A Locket Lost', type: 'side', giver: 'mira',
    desc: 'Mira\'s grandmother dropped her locket near the old pond east of Thornhollow. The water has been strange lately, and Mira is too frightened to look herself.',
    steps: [
      { id: 'accept', text: 'Find the locket near the pond in Greenfall Forest', done: g => g.flags.locketFound, marker: M('greenfall', 40, 95), optionalAccept: true },
      { id: 'return', text: 'Return the locket to Mira in Thornhollow', done: g => false, marker: M('greenfall', 63, 79) },
    ],
    rewards: { xp: 120, gold: 70, item: 'orins_locket', skillPoints: 0 },
  },
  wolves: {
    id: 'wolves', name: 'Teeth of the Wood', type: 'side', giver: 'rook',
    desc: 'Bramble wolves have grown bold enough to stalk the village road. Rook wants their number thinned before someone loses a child to them.',
    steps: [
      { id: 'hunt', text: g => `Hunt Bramble Wolves around Thornhollow (${Math.min(6, g.quests.wolves?.progress || 0)}/6)`, done: g => (g.quests.wolves?.progress || 0) >= 6, marker: M('greenfall', 70, 78) },
      { id: 'return', text: 'Return to Rook at Thornhollow', done: g => false, marker: M('greenfall', 49, 80) },
    ],
    rewards: { xp: 180, gold: 90, item: 'verdant_saber', skillPoints: 1 },
  },
  tome: {
    id: 'tome', name: 'The Buried Tome', type: 'side', giver: 'vela',
    desc: 'Vela has spent years trying to catalogue the ruined archive. One book still eludes her: a grey ledger that supposedly records the day the monuments turned away.',
    steps: [
      { id: 'find', text: 'Search the ruined archive east of the castle', done: g => g.flags.tomeFound, marker: M('kingdom', 108, 58) },
      { id: 'return', text: 'Bring the grey tome to Vela', done: g => false, marker: M('kingdom', 90, 60) },
    ],
    rewards: { xp: 260, gold: 120, item: 'frostguard_mantle', skillPoints: 1 },
  },
  crystals: {
    id: 'crystals', name: 'Shards of Aether', type: 'side', giver: 'ilse',
    desc: 'Keeper Ilse is preserving what little monument-light remains. She asks for eight echo crystals, found where the old world still bleeds colour.',
    steps: [
      { id: 'gather', text: g => `Gather Echo Crystals for Ilse (${Math.min(8, g.player.resources.crystals)}/8)`, done: g => g.player.resources.crystals >= 8, marker: M('sanctuary', 52, 47) },
      { id: 'return', text: 'Return to Keeper Ilse', done: g => false, marker: M('sanctuary', 52, 47) },
    ],
    rewards: { xp: 150, gold: 60, item: 'elixir', skillPoints: 1 },
  },
};

/* ---------------- dialogue trees ---------------- */
function node(name, text, choices = [], portrait = null) {
  return { name, text, choices, portrait };
}

const close = (label = 'Farewell.') => ({ label, action: 'close' });

export const NPCS = {
  maelin: {
    name: 'Elder Maelin', title: 'Keeper of the Sanctuary', accent: '#6fd9c8',
    talk(g) {
      if (g.flags.endingSeen) {
        return node('Elder Maelin', 'The echoes are quiet now. Not gone — resting. I find I can hear the wind again without listening for a voice inside it. Whatever you are, wanderer, you have given the world its silence back.', [
          { label: 'What happens now?', action: 'node', next: node('Elder Maelin', 'Now? We build something that does not require a monument to hold it up. Small things. Bread. Names. The kind of echoes that carry through a room instead of a century.') },
          { label: 'I should go.', action: 'close' },
        ]);
      }
      if (!g.flags.mainStarted) {
        return node('Elder Maelin', 'You came down the old road at a strange hour, and the dust on you is not from any road I know. Sit. The fire is honest, if nothing else is.\n\nSomething has gone wrong with the Echo Monuments. The world is forgetting its own edges. I have been waiting for someone the monuments might still answer.', [
          {
            label: 'What are the Echo Monuments?', action: 'node', next: node('Elder Maelin', 'Three structures older than kings. One in the green, one in the crown, one in the frost. They held the world\'s memory the way a bowl holds water. When they fell silent, the water began to leak out.\n\nThere is a fourth place beneath us. The Chorus. I would rather not speak of it by name.')
          },
          {
            label: 'Why me?', action: 'node', next: node('Elder Maelin', 'Because the crystals near you are brighter. Because you dreamed of a door in the ground before you ever saw one. Because I am old, and you are not.\n\nThat is usually how these things are decided.')
          },
          {
            label: 'I will find the monuments.', action: 'startQuest', quest: 'main',
            reply: node('Elder Maelin', 'Good. Start in Greenfall — the Root Monument still remembers how to grow. Then the crown, then the peak. Each has a guardian now. They will not simply let you pass.\n\nTake this. A keeper\'s habit: never walk into a ruin with empty hands.', [close('I will return.')]),
          },
          { label: 'Not yet.', action: 'close' },
        ]);
      }
      const m = g.flags['monument:greenfall'], c = g.flags['monument:kingdom'], f = g.flags['monument:frost'];
      const count = [m, c, f].filter(Boolean).length;
      if (count >= 3 && !g.flags.mainReturned) {
        return node('Elder Maelin', 'All three. I can feel them from here — like three warm stones in a cold pocket.\n\nThe fourth monument is below us, under the old well. It was never a monument. It was a lid. The Chorus has been singing against it for a hundred years, and now it has learned your name from the other three.\n\nYou do not have to go down. But if you do, I will keep the fire lit.', [
          {
            label: 'Open the well. I will end this.', action: 'action', do: 'openDepths',
            reply: node('Elder Maelin', 'Then take the keeper\'s lantern. The deep places have their own light, but it is not kind light.\n\nWhen you find the Heart, do not listen too closely. It will sound like everyone you have ever missed.', [close('I will come back.')]),
          },
          { label: 'What is the Chorus?', action: 'node', next: node('Elder Maelin', 'A song that learned to want. The old Aetherians built the fourth monument to hold it, then built the other three to make the world forget it. Memory is a door that opens both ways.') },
          { label: 'I need time.', action: 'close' },
        ]);
      }
      if (g.flags.mainReturned && !g.flags['boss:chorus']) {
        return node('Elder Maelin', 'The well is open. Below the roots, past the water, the Chorus is waiting.\n\nYou are not the first to go down. You may be the first to come back up.', [
          { label: 'What should I expect?', action: 'node', next: node('Elder Maelin', 'Three runes hold the inner door. Search the caverns. Light them all and the way will open. And wanderer — the Chorus does not fight fair. It sings.') },
          close('I will return.'),
        ]);
      }
      let text = 'The monuments are waking. I can feel it in the roots under this floor.\n\n';
      if (!m) text += 'Greenfall first. The Root Monument waits at the old shrine in the north-east of the forest. Its guardian has grown terrible.';
      else if (!c) text += 'The Crown Monument waits in the courtyard of the Forgotten Kingdom. The Hollow King still keeps his court there.';
      else if (!f) text += 'The Peak Monument is above the three fires in Frostbound. Light them, and the mountain will remember its manners.';
      else text += 'Return to me when all three are awake.';
      return node('Elder Maelin', text, [
        { label: 'Tell me about the guardians.', action: 'node', next: node('Elder Maelin', 'They were not always guardians. The Root Warden was a keeper of seeds. The Hollow King was a man who refused to leave his post. The peak\'s warden was a promise given a sword.\n\nCorruption did not invent them. It only showed them what they were willing to become.') },
        close('I will continue.'),
      ]);
    },
  },

  brann: {
    name: 'Brann the Smith', title: 'Forge-Master', accent: '#e0a85e',
    talk(g) {
      return node('Brann the Smith', 'Mind the sparks. Or don\'t — a burn is a good reminder that you\'re still soft enough to feel things.\n\nBring me metal or echo shards and I\'ll make your weapons remember being sharper.', [
        { label: 'Show me your wares.', action: 'shop', shop: 'brann' },
        { label: 'Use the Echo Forge.', action: 'forge' },
        { label: 'Tell me about the forge.', action: 'node', next: node('Brann the Smith', 'The forge was built around a splinter of the Root Monument. Not stolen — borrowed, and it knows the difference. Every blade cooled in that water comes out with a little more opinion than it went in with.\n\nThat\'s how you can tell a good blade. It argues back.') },
        close('Keep the fire hot.'),
      ]);
    },
  },

  sera: {
    name: 'Sera the Herbalist', title: 'Greenwarden', accent: '#9fe0b0',
    talk(g) {
      return node('Sera the Herbalist', 'You look like the road chewed you up and spat you out politely. I have something for that. Several somethings, honestly, and most of them are legal.', [
        { label: 'Show me your remedies.', action: 'shop', shop: 'sera' },
        { label: 'Where do you find your herbs?', action: 'node', next: node('Sera the Herbalist', 'Everywhere the light falls differently. Moonleaf by the pond, emberthorn near the forge, gravebloom where the kingdom forgets its dead.\n\nThe dangerous ones grow in the Sunken Depths, but I am not brave enough to pick them. Not yet.') },
        close('Stay well.'),
      ]);
    },
  },

  ilse: {
    name: 'Keeper Ilse', title: 'Archivist of the Hearth', accent: '#b8a6e0',
    talk(g) {
      const q = g.quests.crystals;
      if (!q) {
        return node('Keeper Ilse', 'You have the look of someone collecting stories. Good. Stories are heavier than they appear, and we are running short of shelves.\n\nI am trying to preserve what the Echo Monuments left in the world. Crystals, mostly. Memory made mineral.', [
          { label: 'I can bring you crystals.', action: 'startQuest', quest: 'crystals' },
          { label: 'What happens if the memories fade?', action: 'node', next: node('Keeper Ilse', 'The same thing that happens to a person who forgets their own name. The shape remains, but it stops being a person.\n\nThe world is very good at continuing. It is less good at remembering why.') },
          close('I will return if I find any.'),
        ]);
      }
      if (q.status === 'done') {
        return node('Keeper Ilse', 'The crystals are humming on the shelf. Eight small voices, all saying different things. I have not decided whether that is comforting.\n\nYou have given the world a little more time to explain itself. Thank you.', [close('I am glad.')]);
      }
      if (g.player.resources.crystals >= 8) {
        return node('Keeper Ilse', 'Eight. And still humming together, which is the important part. I can work with this — I can teach the shelf to remember a song instead of just storing the notes.\n\nTake this. It was never mine to keep.', [
          { label: 'Give her the crystals.', action: 'completeQuest', quest: 'crystals' },
          { label: 'Not yet. I may need them.', action: 'close' },
        ]);
      }
      return node('Keeper Ilse', 'Crystals, wanderer. Eight of them. They grow where the old light still needles through the dark — the deep places, the frozen edge of things. Bring them back and I will make it worth the weight.', [
        { label: 'Where should I look?', action: 'node', next: node('Keeper Ilse', 'The Sunken Depths are thick with them, but I would not send a friend down there. Greenfall has a few in the far woods. The kingdom keeps them in its ruins like old coins under a mattress.') },
        close('I will keep looking.'),
      ]);
    },
  },

  pip: {
    name: 'Pip', title: 'Sanctuary Child', accent: '#ffcf7a',
    talk(g) {
      return node('Pip', 'You\'re the one who came in from the smoke road! Garrick says you have "the gait of a doomed hero". That\'s a compliment, probably.\n\nI found a secret once. There\'s a big tree past the river in Greenfall, and a man who lives under it. He talks to roots. The roots don\'t talk back, but he says that\'s just manners.', [
        { label: 'A secret in the forest?', action: 'node', next: node('Pip', 'Cross the old bridge west of Thornhollow and look for the glow. Don\'t tell Mira I told you. She thinks I\'m not allowed to know about the locket either, but I know everything.\n\nWell. Most things. The big tree is grumpy.') },
        { label: 'Who is Garrick?', action: 'node', next: node('Pip', 'He guards the south gate but mostly he tells stories about the war nobody remembers. He gave me a wooden sword. I hit a fence with it once. The fence lost.') },
        close('See you, hero.'),
      ]);
    },
  },

  garrick: {
    name: 'Garrick the Wanderer', title: 'Gate Warden', accent: '#d8b774',
    talk(g) {
      return node('Garrick the Wanderer', 'South gate\'s open. So is the north, the east, and the well, though I\'d advise against the last one.\n\nYou fight like someone who learned from a book and not from a bruise. That can be fixed.', [
        { label: 'Any advice?', action: 'node', next: node('Garrick the Wanderer', 'Watch their shoulders, not their weapons. Everyone telegraphs. The wolf crouches before it springs. The knight raises his shield-arm before the cut. The rest is breathing and not being where the steel is.\n\nAnd dodge toward them, not away. Away is where the follow-up lives.') },
        { label: 'I can handle myself.', action: 'node', next: node('Garrick the Wanderer', 'Of course you can. Everyone can until the first one with a shield. If you change your mind, I\'ll be here, being old at the gate.') },
        close('Keep moving.'),
      ]);
    },
  },

  mira: {
    name: 'Mira of Thornhollow', title: 'Villager', accent: '#e0b080',
    talk(g) {
      const q = g.quests.locket;
      if (!q) {
        return node('Mira of Thornhollow', 'You\'re not from the village. Good. Everyone here is too polite to say what they think, and I have been staring at the water for three days.\n\nMy grandmother\'s locket fell near the pond. It has a root on the clasp. She used to say it kept the forest from taking her name.', [
          { label: 'I will find it.', action: 'startQuest', quest: 'locket' },
          { label: 'What happened to your grandmother?', action: 'node', next: node('Mira of Thornhollow', 'She walked into the trees last winter with a lantern and came back without it. She said the lantern had found a better home.\n\nWe do not talk about the trees doing things. We just hang more salt and hope.') },
          close('Be careful by the water.'),
        ]);
      }
      if (q.status === 'done') {
        return node('Mira of Thornhollow', 'I can hear it ticking again. I did not know a locket could sound so much like a person.\n\nIf you ever need a roof, ours is small but the stew is honest.', [close('Thank you, Mira.')]);
      }
      if (g.flags.locketFound) {
        return node('Mira of Thornhollow', 'You found it? Does it still smell of her garden? She kept rosemary and some terrible purple thing she refused to name.\n\nHere. Take this. Rook says it\'s a charm for wanderers. I think he just likes giving people odd things.', [
          { label: 'Give her the locket.', action: 'completeQuest', quest: 'locket' },
          { label: 'Let me look at it a moment longer.', action: 'close' },
        ]);
      }
      return node('Mira of Thornhollow', 'The pond is east and south of here, past the old milestone. Mind the reeds — they look like water until they don\'t.\n\nAnd if you see a lantern moving under the surface, do not wave back.', [close('I will find it.')]);
    },
  },

  rook: {
    name: 'Rook the Hunter', title: 'Thornhollow Hunter', accent: '#a8d98a',
    talk(g) {
      const q = g.quests.wolves;
      if (!q) {
        return node('Rook the Hunter', 'Every night the wolves come closer. Every morning there are fewer rabbits and more tracks that end at the village fence.\n\nI can kill two before they scatter. I need someone who can kill six before they stop scattering.', [
          { label: 'I will thin the pack.', action: 'startQuest', quest: 'wolves' },
          { label: 'Why are they so bold?', action: 'node', next: node('Rook the Hunter', 'They follow something. Not a leader — something older. I saw the pack part once in the north woods and a tall shape walk between them. It did not have a wolf\'s smell.\n\nSince then they have not been afraid of us.') },
          close('Check your blade.'),
        ]);
      }
      if (q.status === 'done') {
        return node('Rook the Hunter', 'Six fewer. The village will sleep a little deeper tonight, and I will sleep knowing you can move quietly when it matters.\n\nTake this blade. It was my father\'s. He would have liked the way you hold it.', [close('Thank you, Rook.')]);
      }
      const n = Math.min(6, q.progress || 0);
      if (n >= 6) {
        return node('Rook the Hunter', 'The woods are quieter. Not safe — quiet. There is a difference, and I will take it.\n\nThat blade I mentioned. I have been carrying it for a long time and it has started to feel like a decision I keep avoiding.', [
          { label: 'Here. It is done.', action: 'completeQuest', quest: 'wolves' },
          close('I will tell you when the road is clear.'),
        ]);
      }
      return node('Rook the Hunter', `Six wolves. You have counted ${n} so far. They patrol the south road and the edge of the old fields.\n\nDo not chase the one that runs. They like to lead you somewhere.`, [close('I will keep hunting.')]);
    },
  },

  vela: {
    name: 'Vela the Archivist', title: 'Scholar of the Fallen Court', accent: '#c8a6ff',
    talk(g) {
      const q = g.quests.tome;
      if (!q) {
        return node('Vela the Archivist', 'A living person. How inconvenient. I was in the middle of a very productive argument with a dead scholar.\n\nYou are here about the monuments, aren\'t you? Everyone is. Nobody stays long enough to help me catalogue the evidence.', [
          { label: 'What evidence?', action: 'node', next: node('Vela the Archivist', 'The archive east of here once held the Court\'s records. There is a grey ledger — the Keeper\'s Ledger — that records the day the monuments turned away. Find it, and I will share everything I know about the fourth one.\n\nI suspect it is not a monument at all.') },
          { label: 'I will look for the ledger.', action: 'startQuest', quest: 'tome' },
          close('Do not let the books bite.'),
        ]);
      }
      if (q.status === 'done') {
        return node('Vela the Archivist', 'I have read the ledger three times. The handwriting changes on every page toward the end. Not a different hand — the same hand, forgetting how.\n\nThe last entry is just your name. Or a name that could be yours.', [close('I do not like that.')]);
      }
      if (g.flags.tomeFound) {
        return node('Vela the Archivist', 'You found it. The grey one. Do you know how many years I have wanted to touch this and been afraid of what it would say back?\n\nDo not answer that. Just hand it here.', [
          { label: 'Give her the ledger.', action: 'completeQuest', quest: 'tome' },
          { label: 'What if it says something true?', action: 'node', next: node('Vela the Archivist', 'Then it is still a book, and books can be closed. People are harder.') },
        ]);
      }
      return node('Vela the Archivist', 'East of the castle, past the statue yard. The archive still has most of its roof, which is more than I can say for my tent.\n\nLook for a grey binding and a smell of cold ash. The ledger does not like to be read by the same person who opened it.', [close('I will find it.')]);
    },
  },

  ysra: {
    name: 'Ysra the Frostbound', title: 'Hermit of the Peak', accent: '#a8e8ff',
    talk(g) {
      const lit = ['brazier:fr_b1', 'brazier:fr_b2', 'brazier:fr_b3'].filter(f => g.flags[f]).length;
      return node('Ysra the Frostbound', 'You have the smell of the green on you. It does not belong up here, but I will not hold it against you.\n\nThe mountain is a grand old liar. It promises a path and then forgets the path. It promises a death and then keeps that promise precisely.', [
        { label: 'How do I reach the Peak Monument?', action: 'node', next: node('Ysra the Frostbound', `The three fires below the summit are the mountain\'s old lock. Light all three and the way opens. ${lit > 0 ? `You have lit ${lit} of them. The mountain is counting.` : 'Touching them is easy. Convincing them to keep the flame is the work.'}`) },
        { label: 'The ice lake sings at night.', action: 'node', next: node('Ysra the Frostbound', 'Yes. It is not a song. It is a memory of one, and memory is a poor mimic. Do not hum along.') },
        close('Keep your fire close.'),
      ]);
    },
  },

  orin: {
    name: 'Orin the Rootless', title: 'Hermit of the Ancient Grove', accent: '#c8d98a',
    talk(g) {
      return node('Orin the Rootless', 'The tree says you arrived quietly. That is either good manners or fatalism. I have not decided which.\n\nI came out here to listen. The trouble with listening is that eventually something answers.', [
        { label: 'What is this tree?', action: 'node', next: node('Orin the Rootless', 'Older than the first monument. The monuments were built to hold the echo. This tree was already holding its breath when they were young.\n\nThe roots go down to the Chorus. Everything down there does eventually.') },
        { label: 'Do you have anything useful?', action: 'node', next: node('Orin the Rootless', 'There is a chest under the roots on the western side. Consider it a fee for not asking me questions I would have to lie about.\n\nThe locket by the pond belongs to Mira. She would like it back. I have been meaning to return it for forty years. There is always tomorrow with me.') },
        close('Listen well.'),
      ]);
    },
  },
};
