/**
 * The single source of scene colours. Real-life, muted tones.
 * Weather and mood shift these later (e.g. desaturate for overcast).
 */
export const palette = {
  sky: 0xb7c2c9,
  fog: 0xb7c2c9,
  fairway: 0x6f8a52,
  rough: 0x5b6e45,
  trunk: 0x5a4636,
  canopy: 0x4a5e3a,
  basket: 0x8a8f94,
  basketBand: 0xb8962e,
  chain: 0xa7abae,
  tee: 0x9b9184,
  sun: 0xfff3e0,
  ambientSky: 0xdfe6ea,
  ambientGround: 0x5b5446,
  disc: 0xb4583c,
  discTrail: 0xe6dcc8,
  target: 0xe6dcc8,
  aimLine: 0xe6dcc8,
} as const;
