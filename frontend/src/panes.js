export function updatePane(panes, id, patch) {
  return panes.map((pane) => pane.id === id ? { ...pane, ...patch } : pane);
}

export function splitPane(panes, id, newId) {
  return panes.flatMap((pane) => pane.id === id
    ? [pane, { ...pane, id: newId, sources: pane.sources === null ? null : [...pane.sources] }]
    : [pane]);
}

export function splitLayout(layout, id, newId, direction) {
  if (typeof layout === 'string') {
    return layout === id ? { direction, first: id, second: newId } : layout;
  }
  return { ...layout, first: splitLayout(layout.first, id, newId, direction),
    second: splitLayout(layout.second, id, newId, direction) };
}

export function closeLayout(layout, id) {
  if (typeof layout === 'string') return layout === id ? null : layout;
  const first = closeLayout(layout.first, id);
  const second = closeLayout(layout.second, id);
  return first === null ? second : second === null ? first : { ...layout, first, second };
}

export function validLayout(layout, ids) {
  const leaves = [];
  const visit = (node) => {
    if (typeof node === 'string') { leaves.push(node); return true; }
    return node && (node.direction === 'right' || node.direction === 'down') &&
      visit(node.first) && visit(node.second);
  };
  return Boolean(visit(layout)) && leaves.length === ids.length &&
    new Set(leaves).size === ids.length && leaves.every((id) => ids.includes(id));
}

// Keep panes as direct grid children so splitting preserves their terminal state.
export function paneGrid(layout) {
  const rectangles = [];
  const visit = (node, x, y, width, height) => {
    if (typeof node === 'string') {
      rectangles.push({ id: node, x, y, right: x + width, bottom: y + height });
    } else if (node.direction === 'right') {
      visit(node.first, x, y, width / 2, height);
      visit(node.second, x + width / 2, y, width / 2, height);
    } else {
      visit(node.first, x, y, width, height / 2);
      visit(node.second, x, y + height / 2, width, height / 2);
    }
  };
  visit(layout, 0, 0, 1, 1);
  const xs = [...new Set(rectangles.flatMap((r) => [r.x, r.right]))].sort((a, b) => a - b);
  const ys = [...new Set(rectangles.flatMap((r) => [r.y, r.bottom]))].sort((a, b) => a - b);
  const tracks = (values, min) => values.slice(1).map((value, i) =>
    `minmax(${min}px, ${value - values[i]}fr)`).join(' ');
  return {
    style: { gridTemplateColumns: tracks(xs, 320), gridTemplateRows: tracks(ys, 180) },
    panes: Object.fromEntries(rectangles.map((r) => [r.id, {
      gridColumn: `${xs.indexOf(r.x) + 1} / ${xs.indexOf(r.right) + 1}`,
      gridRow: `${ys.indexOf(r.y) + 1} / ${ys.indexOf(r.bottom) + 1}`,
    }])),
  };
}
