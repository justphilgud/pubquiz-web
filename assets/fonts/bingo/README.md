# Bingo print fonts

These are unchanged original font files from the pinned official Google Fonts
revision in `sources.json`. Each file has its upstream license alongside it.
Roboto Slab uses its Apache license; the remaining families use their supplied
OFL license. SHA-256 values and exact source URLs are recorded in the manifest.

The existing Phil Gud original WOFF is used for Phil Gud display headings.
The existing licensed Arimo file is the explicitly labelled Arial-compatible print
face for an Arial/Helvetica selection. A system-ui selection is explicitly labelled
“Geist (druckfähige Systemschrift)”. Other supported choices embed their matching
original family. There is no dependence on installed operating-system fonts and no
silent fallback when loading or embedding a selected print face fails.

At card-series creation, the validated design and the actual font/logo bytes are
stored with their checksums. Reexports never fetch a mutable asset URL or reload a
font from this directory. See the AP2 living specification for persistence details.
