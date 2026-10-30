// Run with: node --test tests/layout.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAspectRatio,
  calculateJustifiedLayout,
  calculateMasonryLayout,
  calculateBalancedJustifiedLayout,
  calculateEnhancedMasonryLayout,
} from '../src/common/layout.ts';

const EPS = 1e-5;

function item(aspect: number, rotate = 0) {
  return { width: aspect * 1000, height: 1000, rotate };
}

function items(aspects: number[]) {
  return aspects.map((aspect) => item(aspect));
}

function close(a: number, b: number, eps = EPS) {
  return Math.abs(a - b) <= eps;
}

function assertBoxesClose(actual: any[], expected: any[]) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) {
    for (const key of ['x', 'y', 'width', 'height']) {
      assert.ok(
        close(actual[i][key], expected[i][key]),
        `box ${i}.${key}: ${actual[i][key]} != ${expected[i][key]}`,
      );
    }
  }
}

function assertNativeAspect(box: any, source: any) {
  assert.ok(close(box.width / box.height, getAspectRatio(source), 1e-4));
}

function assertInsideWidth(boxes: any[], width: number) {
  for (const box of boxes) {
    assert.ok(box.width > 0 && box.height > 0);
    assert.ok(box.x >= -EPS, `x ${box.x}`);
    assert.ok(box.x + box.width <= width + EPS, `right ${box.x + box.width} > ${width}`);
  }
}

function assertNoOverlap(boxes: any[]) {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlapX = a.x < b.x + b.width - EPS && b.x < a.x + a.width - EPS;
      const overlapY = a.y < b.y + b.height - EPS && b.y < a.y + a.height - EPS;
      assert.ok(!(overlapX && overlapY), `boxes ${i} and ${j} overlap`);
    }
  }
}

const mixed = [1.5, 0.67, 1, 1.78, 0.75, 1.33, 0.56, 2.4, 1.2, 0.8, 1.6, 0.5, 1.1, 0.9, 1.45, 0.72];

test('balanced layout with zero boost matches the original justified layout', () => {
  const list = items(mixed);
  const width = 1000;
  const target = 200;
  const legacy = calculateJustifiedLayout(list, width, target, 0);
  const balanced = calculateBalancedJustifiedLayout(list, width, target, 0, { portraitBoost: 0 });
  assertBoxesClose(balanced.boxes, legacy.boxes);
  assert.ok(close(balanced.containerHeight, legacy.containerHeight));
});

test('balanced layout preserves native aspect and stays inside the container', () => {
  const list = items([1.5, 0.67, 1.78, 0.56, 2.4, 0.8, 1.2, 0.5]);
  const width = 1200;
  const result = calculateBalancedJustifiedLayout(list, width, 220, 8, {
    portraitBoost: 0.5,
    maxRowHeightMultiplier: 1.6,
  });
  assert.equal(result.boxes.length, list.length);
  assertInsideWidth(result.boxes, width);
  assertNoOverlap(result.boxes);
  result.boxes.forEach((box, index) => assertNativeAspect(box, list[index]));
});

test('balanced layout gives portrait-heavy rows more height than landscape rows', () => {
  const width = 1200;
  const target = 200;
  const portraits = calculateBalancedJustifiedLayout(items([0.6, 0.62, 0.65, 0.58]), width, target, 0, {
    portraitBoost: 0.5,
    maxRowHeightMultiplier: 1.8,
  });
  const landscapes = calculateBalancedJustifiedLayout(items([1.7, 1.8, 1.65, 1.9]), width, target, 0, {
    portraitBoost: 0.5,
    maxRowHeightMultiplier: 1.8,
  });
  const portraitHeight = Math.max(...portraits.boxes.map((box) => box.height));
  const landscapeHeight = Math.max(...landscapes.boxes.map((box) => box.height));
  assert.ok(portraitHeight > landscapeHeight, `${portraitHeight} <= ${landscapeHeight}`);
});

test('balanced layout does not overflow on a single panorama', () => {
  const list = [item(6)];
  const width = 1000;
  const result = calculateBalancedJustifiedLayout(list, width, 200, 8, { portraitBoost: 0.5 });
  assert.equal(result.boxes.length, 1);
  assertInsideWidth(result.boxes, width);
  assertNativeAspect(result.boxes[0], list[0]);
});

test('balanced layout handles rotated items', () => {
  const list = [item(1.5, 90), item(0.67, 270), item(1, 0)];
  const result = calculateBalancedJustifiedLayout(list, 900, 180, 0, { portraitBoost: 0.4 });
  assert.equal(result.boxes.length, 3);
  result.boxes.forEach((box, index) => assertNativeAspect(box, list[index]));
  assertInsideWidth(result.boxes, 900);
});

test('enhanced masonry with maxSpan 1 matches the original masonry exactly', () => {
  const list = items(mixed);
  const width = 1100;
  const target = 250;
  const legacy = calculateMasonryLayout(list, width, target, 0);
  const enhanced = calculateEnhancedMasonryLayout(list, width, target, 0, { maxSpan: 1 });
  assertBoxesClose(enhanced.boxes, legacy.boxes);
  assert.ok(close(enhanced.containerHeight, legacy.containerHeight));
});

test('enhanced masonry places every item once, keeps aspect, and stays inside', () => {
  const list = items(mixed);
  const width = 1200;
  const result = calculateEnhancedMasonryLayout(list, width, 260, 8, {
    maxSpan: 2,
    adaptiveSpan: true,
  });
  assert.equal(result.boxes.length, list.length);
  assertInsideWidth(result.boxes, width);
  assertNoOverlap(result.boxes);
  result.boxes.forEach((box, index) => assertNativeAspect(box, list[index]));
});

test('enhanced masonry uses the extra span for landscape photos', () => {
  const list = items([1.6, 1.7, 1.8, 1.9]);
  const width = 1200;
  const target = 300;
  const result = calculateEnhancedMasonryLayout(list, width, target, 0, {
    maxSpan: 2,
    adaptiveSpan: true,
  });
  const columnWidth = width / Math.max(1, Math.floor(width / target));
  const wide = result.boxes.filter((box) => box.width > columnWidth + EPS);
  assert.ok(wide.length > 0, 'expected at least one spanning landscape');
  assert.ok(wide.every((box) => box.width <= 2 * columnWidth + EPS));
});

test('enhanced masonry respects a non-adaptive span policy', () => {
  const list = items([1.0, 1.3, 1.5, 2.5]);
  const result = calculateEnhancedMasonryLayout(list, 1200, 250, 0, {
    maxSpan: 3,
    adaptiveSpan: false,
    spanThreshold: 1.4,
  });
  const columnWidth = 1200 / Math.max(1, Math.floor(1200 / 250));
  assert.ok(close(result.boxes[0].width, columnWidth));
  assert.ok(close(result.boxes[1].width, columnWidth));
  assert.ok(result.boxes[2].width > columnWidth + EPS);
  assert.ok(result.boxes[3].width > 2 * columnWidth - EPS);
});

test('enhanced masonry can produce non-monotonic y starts', () => {
  // A wide item placed over two tall columns raises its own y, while the
  // untouched third column can still accept a later short item higher up.
  const list = items([1.8, 1.8, 0.5, 1.8, 0.5]);
  const result = calculateEnhancedMasonryLayout(list, 900, 300, 0, {
    maxSpan: 2,
    adaptiveSpan: true,
  });
  let sawDecrease = false;
  for (let i = 1; i < result.boxes.length; i++) {
    if (result.boxes[i].y < result.boxes[i - 1].y - EPS) sawDecrease = true;
  }
  assert.ok(sawDecrease, 'fixture should exercise non-monotonic starts');
});
