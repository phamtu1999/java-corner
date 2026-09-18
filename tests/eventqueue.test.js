import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventQueue } from '../web/emulator/src/eventqueue.js';

test('delivers the last queued key release without waiting for another input', async () => {
    const queue = new EventQueue();
    const pressed = queue.waitForEvent();
    queue.queueEvent({ kind: 'keydown' });
    queue.queueEvent({ kind: 'keyup' });
    assert.equal((await pressed).kind, 'keydown');
    const release = queue.waitForEvent();
    let timer;
    try {
        const result = await Promise.race([
            release,
            new Promise(resolve => { timer = setTimeout(() => resolve('stalled'), 50); })
        ]);
        assert.deepEqual(result, { kind: 'keyup' });
    } finally { clearTimeout(timer); }
    const next = queue.waitForEvent();
    queue.queueEvent({ kind: 'pointerpressed' });
    assert.deepEqual(await next, { kind: 'pointerpressed' });
});
