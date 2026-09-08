# Basalt–Carbon Aging Lab

Interactive companion to the final-year project *Effects of environmental aging on the mechanical properties of synthetic–natural fibre reinforced hybrid composites* (NUST College of E&ME, 2024): carbon, basalt and two carbon-core/basalt-skin hybrid laminates, aged 10 and 20 days in home-built IoT chambers and tested in three-point flexure (ASTM D7264) and short-beam shear (ASTM D2344).

**Live:** https://shahroz657.github.io/composite-aging-lab/

What the page does:

- Turns the four eight-ply laminates over in 3D, with procedurally woven carbon and basalt plies, and explodes each stack.
- Rebuilds both aging rigs (the heated saline bath and the humidity chamber) with every component labelled, plus a simulated view of the relay controller holding its setpoint.
- Loads every specimen from the report in a 3D test rig with its own dimensions, modulus and failure load: bending deflection from the beam equation, cracking at the recorded load, and the through-thickness stress diagrams.
- Charts every measured result with both specimens visible, retention after 20 days, and where the hybrids sit between carbon and basalt, with the published benchmark the report validated against.
- A Fickian moisture model (labelled as a model) showing why 10 and 20 days leave a 4 mm laminate far from saturation.
- A checks section listing what a careful reader should know: the factor-of-two in the strength formulas, plot-versus-table differences, two specimens per point, unstated bath conditions, and woven versus unidirectional fabric.

No experimental value was altered. Everything measured is transcribed from the report's tables; everything modelled says so on the page.

## Running

Plain HTML and ES modules; Three.js comes from a CDN through an import map. `python3 tools/serve.py 5174` and open http://127.0.0.1:5174/. `python3 tools/build_single.py` writes a single-file copy to `dist/`.

## Credits

Study by Romman Ahmed, Muhammad Shahroz, Qasim Mushtaq and Muhammad Usman Malik, supervised by Asst. Prof. Dr. Zubair Sajid with Asst. Prof. Dr. Rehan Khan, NUST College of Electrical & Mechanical Engineering. Page built with Three.js and IBM Plex. MIT licence.
