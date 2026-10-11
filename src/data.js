// All the words, numbers and lies that make up Rockport.

export const GAME_SECONDS = 150; // 5:00 PM -> 7:30 PM, one game-minute per real second
export const START_BATTERY = 12;
export const START_MINUTES = 17 * 60;

// THE OBJECTIVES. Big, clear, on screen at all times.
export const FISH_GOAL = 3;
export const CHARGE_GOAL = 80;
export const GOAL_BONUS = 1000;

// ---------------------------------------------------------------- FISH
// diff: 1-5 reel difficulty. mult: point multiplier. tier: 0 common, 1 good, 2 weird, 3 legendary
export const FISH = {
  redfish: { name: 'REDFISH', lbs: [4, 12], diff: 3, mult: 1.4, tier: 1, model: 'fish', color: 0xd9692b, belly: 0xf3c9a0, spot: true,
    desc: 'Has one spot on its tail. Refuses to explain it.' },
  trout: { name: 'SPECKLED TROUT', lbs: [1.5, 5], diff: 2, mult: 1.3, tier: 1, model: 'fish', color: 0x9fb3b8, belly: 0xe8f0f0, speckles: true,
    desc: 'Speckled. Trout. Speckled trout. That\'s the whole bit.' },
  flounder: { name: 'SOUTHERN FLOUNDER', lbs: [1, 6], diff: 2, mult: 1.3, tier: 1, model: 'flounder', color: 0x8a7350, belly: 0xd8ccb0,
    desc: 'Both eyes on one side. Sees twice the drama.' },
  drum: { name: 'BLACK DRUM', lbs: [5, 25], diff: 4, mult: 1.0, tier: 1, model: 'fish', color: 0x3a3a42, belly: 0x77778a, chunky: true,
    desc: 'Makes drumming noises. Has strong opinions about jazz.' },
  sheepshead: { name: 'SHEEPSHEAD', lbs: [2, 8], diff: 3, mult: 1.3, tier: 1, model: 'fish', color: 0xc9c9c0, belly: 0xffffff, stripes: true, teeth: true,
    desc: 'Has human teeth. Do not make eye contact.' },
  catfish: { name: 'HARDHEAD CATFISH', lbs: [0.5, 3], diff: 1, mult: 0.8, tier: 0, model: 'fish', color: 0x6b6f5e, belly: 0xbfc2ae, whiskers: true,
    desc: 'Everyone\'s least favorite fish. Including itself.' },
  pinfish: { name: 'PINFISH', lbs: [0.2, 0.6], diff: 1, mult: 1.0, tier: 0, model: 'fish', color: 0xb8c4a0, belly: 0xf0f0d8, small: true,
    desc: 'Tiny. Brave. Mostly bait, emotionally.' },
  mullet: { name: 'MULLET', lbs: [0.5, 2], diff: 1, mult: 1.0, tier: 0, model: 'fish', color: 0x7f8c95, belly: 0xdde6ea, mulletHair: true,
    desc: 'Business in the front. Party in the back.' },
  eel: { name: 'ELECTRIC EEL', lbs: [3, 8], diff: 4, mult: 1.5, tier: 2, model: 'eel', color: 0x334455, belly: 0xffdd33, battery: 25,
    desc: 'Not native. Absolutely buzzing. Plugged it into the car. Don\'t ask.' },
  lithium: { name: 'LITHIUM MULLET', lbs: [1, 3], diff: 3, mult: 1.6, tier: 2, model: 'fish', color: 0x8a9aa8, belly: 0xccddee, batteryPack: true, mulletHair: true, battery: 12,
    desc: 'A mullet with a 48V battery pack where its skeleton should be.' },
  sock: { name: 'A SINGLE WET SOCK', lbs: [0.1, 0.2], diff: 1, mult: 5, tier: 2, model: 'sock', color: 0xffffff, belly: 0xe03030,
    desc: 'Size 11. Right foot. Somehow still warm???' },
  crab: { name: 'HAUNTED CRAB', lbs: [1, 3], diff: 3, mult: 2.0, tier: 2, model: 'crab', color: 0x7a3fd0, belly: 0xc49bff,
    desc: 'It whispers your battery percentage. It\'s always wrong.' },
  crane: { name: 'WHOOPING CRANE', lbs: [14, 16], diff: 5, mult: 0, tier: 2, model: 'crane', color: 0xffffff, belly: 0xd02020, karma: 600,
    desc: 'PUT IT BACK. IT IS ENDANGERED. (You put it back. +600 KARMA)' },
  tuesday: { name: 'THE CONCEPT OF TUESDAY', lbs: [0, 0], diff: 2, mult: 0, tier: 2, model: 'tuesday', color: 0x8844ff, belly: 0xffcc00, flat: 222,
    desc: 'You caught Tuesday. Everything feels slightly more like a Tuesday.' },
  speaker: { name: 'BLUETOOTH SPEAKER', lbs: [1, 1.4], diff: 2, mult: 3, tier: 2, model: 'speaker', color: 0x222233, belly: 0x33ffcc,
    desc: 'Still playing. Connected to somebody\'s phone in Corpus.' },
  dentures: { name: 'CAPTAIN\'S DENTURES', lbs: [0.3, 0.4], diff: 2, mult: 9, tier: 2, model: 'dentures', color: 0xfff8ee, belly: 0xff8899,
    desc: 'The shrimp boat captain wants these back. Can\'t say so, though.' },
  smallcar: { name: 'A SMALLER CAR', lbs: [2, 3], diff: 4, mult: 4, tier: 2, model: 'smallcar', color: 0x5fe0c0, belly: 0x223344,
    desc: 'It\'s your car, but tiny. It also needs a charge.' },
  golden: { name: 'THE GOLDEN REDFISH', lbs: [20, 30], diff: 5, mult: 3, tier: 3, model: 'fish', color: 0xffc400, belly: 0xfff0a0, spot: true, glow: true,
    desc: 'Legends say it charges 10-80% in 18 minutes. Legends lie.' },
};

// ---------------------------------------------------------------- FISHING SPOTS
export const SPOTS = [
  { id: 'causeway', name: 'COPANO CAUSEWAY', pos: [-20, -192], dir: [0, -1], cast: 26,
    table: { redfish: 3, trout: 5, catfish: 3, sock: 1, speaker: 1.2, eel: 1, golden: 0.25 } },
  { id: 'harbor', name: 'ROCKPORT HARBOR DOCK', pos: [62, 0], dir: [1, 0], cast: 24,
    table: { drum: 4, sheepshead: 4, mullet: 3, lithium: 2, dentures: 2, catfish: 2, smallcar: 1 } },
  { id: 'pier', name: 'ROCKPORT BEACH PIER', pos: [158, 140], dir: [1, 0], cast: 26,
    table: { redfish: 4, flounder: 4, trout: 3, eel: 2, pinfish: 2, crab: 1, golden: 0.35 } },
  { id: 'bigtree', name: 'BIG TREE PUDDLE', pos: [-150, -63], dir: [0, -1], cast: 9,
    table: { tuesday: 1, crane: 0.5, crab: 3, sock: 2, eel: 1.2, lithium: 1.5, mullet: 1.5 } },
];

// ---------------------------------------------------------------- CHARGERS
export const ADAPTERS = {
  nema515: { name: 'NEMA 5-15 → J1772', icon: '▯▯' },
  nema1450: { name: 'NEMA 14-50 → J1772', icon: '◖▮◗' },
  ccs: { name: 'CCS1 COMBO THINGY', icon: '⊙⊙' },
  l2130: { name: 'L21-30 TWIST-LOCK (SALTY)', icon: '⟲' },
  clamps: { name: 'COPPER CLAMPS OF DESTINY', icon: '⚡' },
  nacs: { name: 'NACS → J1772 (DONGLE)', icon: '◉' },
};

export const JOKE_ADAPTERS = [
  { name: 'GARDEN HOSE', icon: '〰', joke: 'You plugged a garden hose into the car. The car is now hydrated. Not charged. Hydrated.' },
  { name: 'HOT DOG (RAW)', icon: '🌭', joke: 'Electricity flowed through the hot dog. It is cooked now. Shaheen eats it. Morale +1.' },
  { name: 'USB-C (LOL)', icon: '▭', joke: 'Charging at 5V. Estimated time to full: four (4) years.' },
  { name: 'A FISH (ALIVE)', icon: '🐟', joke: 'The fish does not conduct well. The fish is upset. You put the fish back.' },
  { name: '3.5MM AUX CORD', icon: '♪', joke: 'The car is now playing smooth jazz at full volume. No charge, though.' },
  { name: 'CRAB (HELPFUL?)', icon: '🦀', joke: 'The crab pinched the outlet. Sparks everywhere. The crab looks proud of itself.' },
  { name: 'EXTENSION CORD → MORE EXTENSION CORDS', icon: '∞', joke: 'It\'s extension cords all the way down. You found the end. It was plugged into itself.' },
];

export const CHARGERS = [
  { id: 'lupe', name: 'GRANDMA LUPE\'S PORCH OUTLET', volts: '120V AC', plug: 'NEMA 5-15', adapter: 'nema515',
    pos: [-82, 46], rate: 3.6, patience: 13, needle: 'gentle', scale: 240, unit: 'V', green: [0.36, 0.64],
    quotes: ['"Mijo, don\'t trip the breaker. The shrimp are in the deep freeze."', '"You look skinny. Charge your little car, then eat something."'],
    tripped: 'Grandma Lupe flipped the breaker off. "That\'s enough electricity for one day."' },
  { id: 'bait', name: 'BAIT & VOLT DRYER PLUG', volts: '240V', plug: 'NEMA 14-50', adapter: 'nema1450',
    pos: [4, -36], rate: 5.5, patience: 11, needle: 'swing', scale: 480, unit: 'V', green: [0.4, 0.6],
    quotes: ['"Live shrimp, dead batteries, ice. We got it all."', '"Dryer\'s unplugged. Somebody\'s towels are still wet in there. Not my problem."'],
    tripped: 'Somebody needed the dryer back. Wet towels win again.' },
  { id: 'mega', name: 'MEGA-CHARGE 9000™', volts: '400–800V DC (ALLEGEDLY)', plug: 'CCS1', adapter: 'ccs',
    pos: [-122, 122], rate: 11, patience: 9, needle: 'chaos', scale: 1000, unit: 'V', green: [0.42, 0.58], handshake: true,
    quotes: ['"WELCOME VALUED DRIVER. PLEASE DOWNLOAD THE APP. PLEASE DOWNLOAD THE OTHER APP."', '"INSERT CARD. INSERT DIFFERENT CARD. INSERT FAITH."'],
    tripped: 'MEGA-CHARGE 9000™ has entered sleep mode to "think about what it did."' },
  { id: 'gen', name: 'SHRIMP BOAT GENERATOR', volts: '120/208/277V ?! 3-PHASE', plug: 'L21-30 (SALTY)', adapter: 'l2130',
    pos: [22, 32], rate: 6.5, patience: 11, needle: 'phase', scale: 360, unit: 'V', green: [0.4, 0.6],
    quotes: ['Captain Ray: "She runs on diesel and spite. Mostly spite."', 'Captain Ray: "Three phases. Like the moon, but angrier."'],
    tripped: 'The generator coughed, sputtered, and started playing a sea shanty instead.' },
  { id: 'rod', name: 'FULTON MANSION LIGHTNING ROD', volts: '1.21 JIGAWATTS', plug: 'BARE COPPER + VIBES', adapter: 'clamps',
    pos: [26, -88], rate: 28, patience: 8, needle: 'lightning', scale: 1210000000, unit: 'W', green: [0.4, 0.6],
    quotes: ['The historic mansion hums ominously. A ghost in a top hat gives you a thumbs up.', 'The sky turns a color that does not have a name yet.'],
    tripped: 'The storm cloud got bored and floated to Port Aransas.' },
  { id: 'dale', name: 'DALE (HAS JUMPER CABLES)', volts: '12V (DALE-RATED)', plug: 'ALLIGATOR CLIPS', adapter: null,
    pos: [32, 110], special: 'dale',
    quotes: ['Dale: "Pop the hood." (It\'s a frunk. There\'s a cooler in it.)', 'Dale: "I\'ve jumped boats, trucks, a golf cart, and one time a guy."'],
    tripped: '' },
];

export const DALE_LINES = [
  'Dale clamped onto something under the cooler. It worked. Nobody knows why.',
  'Dale revved his truck for 8 seconds. Your car gained 12%. Physics filed a complaint.',
  'Dale says "that oughta do ya." It does, in fact, do ya.',
];

// ---------------------------------------------------------------- RADIO + EVENTS
export const RADIO = [
  'You\'re listening to K-WATT 88.1, Rockport\'s only station broadcasting from inside a pelican.',
  'Traffic: a shrimp boat is on Highway 35 again. It has its blinker on. Be kind.',
  'Weather: sunny, 84 degrees, 90% chance of mixed voltages.',
  'Local man Dale reports he still has jumper cables. More at 11.',
  'The Big Tree is over a thousand years old and would like you to stop asking about it.',
  'Grandma Lupe says if you trip her breaker one more time she\'s calling your mother.',
  'The MEGA-CHARGE 9000 is working today! (This has not been confirmed.)',
  'A whooping crane was seen ordering a large drink at a gas station. It did not pay.',
  'Science corner: a volt is how badly an electron wants something.',
  'This hour brought to you by Bait & Volt. Live shrimp. Dead batteries. Ice.',
  'Sunset is at 7:30. The weigh-in waits for no one. Except Dale. It waits for Dale.',
  'Breaking: a redfish was spotted with TWO spots. Authorities are baffled.',
  'Song request from a flounder: "anything, as long as it\'s flat."',
  'Reminder: Copano Bay is not a charger. Please stop driving into it.',
  'The Fulton Mansion\'s ghost would like everyone to know it is "very into EVs now."',
  'Captain Ray has lost his dentures again. If found, please return them. Gently.',
  'Shout out to the person who caught the concept of Tuesday last week. We all felt it.',
  'Now playing: "Smooth Voltage" by the Aransas Bay Boys. A local classic.',
];

export const EVENTS = [
  { id: 'gust', radio: 'GUST ALERT: a wind from the Gulf is pushing everything slightly west. Hold on to your hats.' },
  { id: 'mosquito', radio: 'MOSQUITO BLOOM: they\'re drinking electricity now. -3% battery. Nature is healing.' },
  { id: 'pelican', radio: 'PELICAN AIRDROP: a pelican just spat a AA battery into your sunroof. +6%!' },
  { id: 'fog', radio: 'VOLTAGE FOG rolling in off the bay. It\'s green. It tastes like pennies.' },
  { id: 'cranes', radio: 'CRANE PARADE: the whooping cranes are doing their walk. Do NOT honk at the cranes.' },
];

// ---------------------------------------------------------------- MENUS + TEXT
export const TIPS = [
  'TIP: The needle is not your friend. The needle has never been your friend.',
  'TIP: Electric eels charge your car. Do not ask how. Do not ask Dale how.',
  'TIP: Grandma Lupe\'s outlet is slow but steady. Like Grandma Lupe.',
  'TIP: The lightning rod delivers 1.21 jigawatts. Hold only when it dips into the green.',
  'TIP: Perfect (gold) casts attract legendary fish. And socks.',
  'TIP: Dale has jumper cables. That isn\'t how electric cars work. Dale doesn\'t care.',
  'TIP: At 0% battery, Shaheen gets out and pushes. Shaheen is very strong.',
  'TIP: Honking near whooping cranes scares them. Please don\'t scare the cranes.',
  'TIP: The fish in the Big Tree puddle are ancient and deeply weird.',
  'TIP: Weigh in before sunset for a bonus. Or don\'t, and pay the pelican.',
];

export const INTRO = [
  'ROCKPORT, TEXAS.\nTHE GULF COAST.\n4:58 PM.',
  'SHAHEEN has two dreams:\ncatch fish in Aransas Bay...\n...and get a 2011 Volta Bayrunner EV charged up.',
  'Problem: the car is at 12%.\nThe chargers in this town are "artisanal."\nEvery one runs a different voltage.\nOne is a lightning rod.',
];

export const RANKS = [
  [0, 'BAIT', 'Judge Clawdia clicks once. That\'s bad.'],
  [600, 'WET SOCK ENTHUSIAST', 'Judge Clawdia has seen worse. Not much worse.'],
  [1300, 'CERTIFIED DOCK GOBLIN', 'Judge Clawdia nods. A goblin of the docks. Respectable.'],
  [2200, 'VOLTAGE ANGLER', 'Judge Clawdia raises one claw. That\'s the good claw.'],
  [3200, 'THE REDFISH WHISPERER', 'Judge Clawdia weeps salty tears. The redfish whisper back.'],
  [4200, 'SHAHEEN, LORD OF FISH-O-WATTS', 'Judge Clawdia bows. The bay bows. Dale cries in his truck.'],
];

export const CAST_THOUGHTS = [
  'Shaheen contemplates the voltage of the soul...',
  'Shaheen wonders if fish know about electricity...',
  'A pelican watches judgmentally...',
  'Shaheen hums the K-WATT jingle...',
  'The bobber bobs. The bobber is at peace...',
  'Somewhere, Dale revs a truck...',
  'Shaheen calculates kilowatt-hours per redfish...',
];
