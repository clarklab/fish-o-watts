# SHAHEEN'S FISH-O-WATTS 🎣⚡

*A Rockport, TX voltage odyssey.* This is a browser game that takes about 3 minutes and plays like it came out of a 2004 PS2 bargain bin. Shaheen drives a 2011 Volta Bayrunner EV around Rockport. The goals are to catch fish and to charge the car on the town's very sketchy, mixed-voltage chargers before the sun goes down.

It's built mobile-first (portrait or landscape) and also plays fine on desktop.

**▶ Play: https://rockport.superfun.games**

## The objectives

These are always on screen in the HUD checklist:

1. **🎣 CATCH 3 FISH.** Drive into a **blue** beacon and press **FISH**.
   - Tap to cast (aim for **GOLD**).
   - Tap when the bobber dips (**!**).
   - **HOLD** to keep the fish inside the green box until the meter fills.
2. **⚡ CHARGE THE CAR TO 80%.** Drive into a **yellow** beacon and press **CHARGE**.
   - Pick the adapter that fits the plug.
   - **HOLD** while the needle is in the **green**. Red means ZAP.
3. **🏆 WEIGH IN BEFORE SUNSET.** This unlocks once 1 and 2 are done. Drive to the **pink** beacon on the beach.

A Crazy-Taxi-style arrow floats over the car and always points at the next thing to do. The **NEXT** bar at the bottom of the screen says what and where.

Controls:
- **Touch:** drag anywhere on screen to drive (the stick appears under your thumb). The action button pops up when you reach a beacon.
- **Keyboard:** WASD or the arrow keys to drive, Space for the action button, H to honk, Esc to pause.

## Rockport, as rendered by a fever dream

**Chargers**
- **Grandma Lupe's Porch Outlet:** 120V. Slow and steady, like Grandma Lupe.
- **Bait & Volt Dryer Plug:** 240V. Somebody's wet towels are still in there.
- **MEGA-CHARGE 9000™:** 400–800V DC, allegedly. Usually needs to be smacked.
- **Shrimp Boat Generator:** 120/208/277V, all three phases, all at once.
- **Fulton Mansion Lightning Rod:** 1.21 jigawatts. Hold only when it dips into the green.
- **Dale:** has jumper cables. That isn't how EVs work, and Dale doesn't care.

**Fishing spots**
- Copano Causeway
- Rockport Harbor Dock
- Rockport Beach Pier
- The Big Tree Puddle, where the fish are ancient and weird

**Catches** include redfish, speckled trout, flounder, electric eels (which charge your car), a lithium mullet, a single wet sock, the concept of Tuesday, and occasionally a whooping crane (put it back).

**Also in town:** K-WATT 88.1, broadcasting from inside a pelican. The weigh-in is judged by Judge Clawdia, a giant crab in a wig.

## Development

```bash
npm install
npm run dev      # http://localhost:5173 (also on your LAN for phone testing)
npm run build    # outputs to dist/
npm run preview
```

Stack: [three.js](https://threejs.org/) and Vite, with no other runtime dependencies.
- Every model, texture, sign and sound is generated in code: low-poly vertex-colored meshes, canvas textures, and Web Audio synth music and SFX.
- Static scenery is merged into a couple of draw calls, so a full frame is about 22 draw calls.
- The PS2 look comes from a low internal render resolution, no anti-aliasing, flat shading, fog, scanlines and a fake console boot screen.

Options menu:
- **Video mode:** 480i, 240p or "HD".
- **Scanlines** on or off.
- **Weirdness:** BONKERS, BONKERS+ or MAXIMUM BONKERS. It cannot be lowered.

## Deploying to Netlify

Production is **https://rockport.superfun.games**. Netlify auto-deploys every push to `main`, and every PR gets a deploy preview.

`netlify.toml` holds the build settings:

- Build command: `npm run build`
- Publish directory: `dist`
- Node: 22

