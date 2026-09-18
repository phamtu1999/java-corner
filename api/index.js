import {createServer} from 'node:http';
import {createApp} from '../server/app.js';
import {attachGameNetwork} from '../server/game-network.js';

const {app, db} = await createApp();
const server = createServer(app);
attachGameNetwork(server, db);
// Vercel owns the listener and the function lifecycle.
export default server;
