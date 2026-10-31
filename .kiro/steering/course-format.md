---
inclusion: fileMatch
fileMatchPattern: '{packages/course-format,courses}/**'
---
# Course Format

- This package is the contract between hand-built courses, the editor, and any future generator.
- Types only plus small pure helpers. No I/O here.
- Coordinates are metres. x/z is the ground plane and y is up (matches Three.js).
- Any breaking change to the shape bumps `COURSE_FORMAT_VERSION` and needs a migration.
- Trees always have separate `trunk` and `canopy` dimensions.
- Aim regions are hand-drawn polygons per hole.
