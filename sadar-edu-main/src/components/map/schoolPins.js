const outline = 'M16 1.5C8.3 1.5 2.4 7.2 2.4 14.8c0 7.3 7.9 16.4 12.7 22.6a1.1 1.1 0 0 0 1.8 0c4.8-6.2 12.7-15.3 12.7-22.6C29.6 7.2 23.7 1.5 16 1.5Z';
const building = 'M7.6 14.4 13 12v-1.7l3-2.6 3 2.6V12l5.4 2.4 M9 14v6.2h14V14 M13 12v8 M19 12v8 M15.2 20v-3h1.6v3';

const pinColors = {
  negeri: '#146653',
  swasta: '#aa520c',
  unknown: '#586779',
};

// The map sprite and its legend use the same silhouette and school pictogram.
export function schoolPinLegend(key) {
  const color = pinColors[key];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40"><path d="${outline}" fill="${color}" stroke="white" stroke-width="1.7"/><path d="${building}" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export function registerSchoolPins(map) {
  for (const [key, color] of Object.entries(pinColors)) {
    const id = 'school-pin-' + key;
    if (map.hasImage(id)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.7;
    ctx.fillStyle = color;
    const pin = new Path2D(outline);
    ctx.fill(pin);
    ctx.stroke(pin);
    ctx.lineWidth = 1.8;
    ctx.stroke(new Path2D(building));
    map.addImage(id, ctx.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: 2 });
  }
}
