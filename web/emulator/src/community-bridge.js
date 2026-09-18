export async function currentUser() {
    const response = await fetch('/api/me');
    if (!response.ok) throw new Error('Không kết nối được tài khoản. Hãy quay về trang cộng đồng.');
    return (await response.json()).user;
}
export function communityAppId(gameId, user) {
    return `community_${gameId.replaceAll('-', '')}_${user ? user.id.replaceAll('-', '') : 'guest'}`;
}
export function communityGameId(appId) {
    const match = /^community_([a-f0-9]{32})_(?:[a-f0-9]{32}|guest)$/.exec(appId);
    if (!match) return null;
    const id = match[1];
    return `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}`;
}
export async function resolveCommunityGame(id) {
    const [response, user] = await Promise.all([fetch(`/api/games/${encodeURIComponent(id)}`), currentUser()]);
    const game = await response.json();
    if (!response.ok) throw new Error(game.error || 'Game không còn khả dụng.');
    return { game, user, appId: communityAppId(game.id, user) };
}
export function recordPlay(id) {
    fetch(`/api/games/${encodeURIComponent(id)}/play`, { method: 'POST', headers: { 'X-Requested-With': 'JavaCommunity' } })
        .then(response => { if (!response.ok && response.status !== 401) console.warn('Không ghi được lịch sử chơi.'); })
        .catch(() => console.warn('Mất kết nối: chưa ghi được lịch sử chơi.'));
}
