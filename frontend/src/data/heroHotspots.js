/**
 * Hotspot data for SIKopi Hero Interactive Scene
 * viewBox: 0 0 1200 680
 */
export const HERO_HOTSPOTS = [
  {
    id: 'papan-menu',
    name: 'Papan Menu',
    x: 80,
    y: 70,
    width: 220,
    height: 150,
    outlinePath: 'M 80,70 L 300,70 L 300,220 L 80,220 Z',
    label: 'MENU HARI INI',
    action: '#katalog-section',
    isLink: true,
    labelPos: { x: 190, y: 250 },
    arrowPath: 'M 190,225 Q 190,240 190,245'
  },
  {
    id: 'kasir',
    name: 'Area Kasir',
    x: 90,
    y: 300,
    width: 130,
    height: 90,
    outlinePath: 'M 90,305 L 210,305 L 210,380 L 90,380 Z',
    label: 'PESAN DI SINI',
    action: '#katalog-section',
    isLink: true,
    labelPos: { x: 150, y: 275 },
    arrowPath: 'M 150,285 Q 150,295 150,300'
  },
  {
    id: 'mesin-kopi',
    name: 'Mesin Kopi Espresso',
    x: 480,
    y: 250,
    width: 220,
    height: 130,
    outlinePath: 'M 490,260 L 700,260 L 700,380 L 490,380 Z',
    label: 'DIRACIK BARISTA',
    action: null,
    isLink: false,
    labelPos: { x: 595, y: 220 },
    arrowPath: 'M 595,230 Q 595,245 595,255'
  },
  {
    id: 'etalase',
    name: 'Etalase Pastry',
    x: 180,
    y: 275,
    width: 180,
    height: 105,
    outlinePath: 'M 180,275 L 360,275 L 360,380 L 180,380 Z',
    label: 'PASTRY & CAMILAN',
    action: '#katalog-section',
    isLink: true,
    labelPos: { x: 270, y: 245 },
    arrowPath: 'M 270,255 Q 270,265 270,270'
  },
  {
    id: 'counter-kanan',
    name: 'Meja Pengambilan',
    x: 840,
    y: 320,
    width: 220,
    height: 80,
    outlinePath: 'M 850,330 L 1060,330 L 1060,380 L 850,380 Z',
    label: 'AMBIL DI SINI',
    action: 'last-order',
    isLink: true,
    labelPos: { x: 950, y: 290 },
    arrowPath: 'M 950,300 Q 950,315 950,325'
  }
]
