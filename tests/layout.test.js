import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLayout, fitScale, layouts } from '../web/emulator/src/layout.js';

test('restores valid layouts, defaults safely and fits small screens', () => {
    for (const layout of layouts) assert.equal(resolveLayout(layout, false), layout);
    assert.equal(resolveLayout('unknown', true), 'bottom');
    assert.equal(resolveLayout(null, false), 'screen');
    assert.equal(fitScale(120, 160, 240, 320, false), .5);
    assert.equal(fitScale(600, 700, 240, 320, false), 2);
    assert.equal(fitScale(600, 700, 240, 320, true), 2.1875);
});
