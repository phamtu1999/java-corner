// Metadata only: Java storage remains the source of truth for files and saves.
const key = user => 'java-corner.library-preview.v1:' + (user?.id || 'guest');
const emptyIcon = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
function previewIcon(icon) {
    if (typeof icon !== 'string') return emptyIcon;
    if (/^data:image\/(png|gif|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(icon)) return icon;
    // Files read from the Java filesystem can arrive as untyped binary Blobs.
    // Recover PNG icons without allowing external URLs or executable formats.
    const png = /^data:(?:application\/octet-stream)?;base64,(iVBORw0KGgo[A-Za-z0-9+/=]*)$/.exec(icon);
    return png ? 'data:image/png;base64,' + png[1] : emptyIcon;
}
export function readLibraryPreview(storage, user) {
    try {
        const games = JSON.parse(storage.getItem(key(user)));
        if (!Array.isArray(games) || !games.every(game => game &&
            typeof game.appId === 'string' && typeof game.name === 'string')) return null;
        return games.map(({appId,name,icon}) => ({appId,name,icon:previewIcon(icon)}));
    } catch { return null; }
}
export function writeLibraryPreview(storage, user, games) {
    try {
        storage.setItem(key(user), JSON.stringify(games.map(({appId,name,icon}) => ({appId,name,icon:previewIcon(icon)}))));
    } catch { /* Storage may be disabled or full; the live library still works. */ }
}
