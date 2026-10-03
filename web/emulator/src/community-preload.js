import {resolveCommunityGame} from './community-bridge.js';
import {readLibraryPreview} from './library-preview.js';
import {downloadGame} from './download-progress.js';

// Settle failures immediately: Java can still be loading when the request fails.
const settle = promise => promise.then(value => ({value}), error => ({error}));

export function prepareCommunityGame(id, {
    storage = globalThis.localStorage,
    onProgress = () => {},
    resolve = resolveCommunityGame,
    readPreview = readLibraryPreview,
    download = downloadGame,
} = {}) {
    return settle((async () => {
        const context = await resolve(id);
        const cached = readPreview(storage, context.user);
        // An absent/invalid cache is inconclusive. Check Java storage first then.
        const missing = cached && !cached.some(game => game.appId === context.appId);
        const bytes = missing
            ? settle(download('/api/games/' + encodeURIComponent(context.game.id) + '/file', onProgress))
            : null;
        return {context, bytes};
    })());
}
