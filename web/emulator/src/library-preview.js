// Metadata only: Java storage remains the source of truth for files and saves.
const key = user => 'java-corner.library-preview.v1:' + (user?.id || 'guest');
export function readLibraryPreview(storage, user) {
    try {
        const games = JSON.parse(storage.getItem(key(user)));
        if (!Array.isArray(games) || !games.every(game => game &&
            typeof game.appId === 'string' && typeof game.name === 'string' &&
            typeof game.icon === 'string' && /^data:image\/(png|gif|jpeg|webp);base64,/.test(game.icon))) return null;
        return games;
    } catch { return null; }
}
export function writeLibraryPreview(storage, user, games) {
    try {
        storage.setItem(key(user), JSON.stringify(games.map(({appId,name,icon}) => ({appId,name,icon}))));
    } catch { /* Storage may be disabled or full; the live library still works. */ }
}
