import {confirmAction,showMessage} from '../../ui/dialogs.js';
import './touch-settings.js';
import {setupGamepad} from './gamepad.js';
import './support.js';
import {setupTextInput} from './text-input.js?v=1';
import relayNatives from './relay.js?v=2';
import { communityGameId, resolveCommunityGame, recordPlay } from "./community-bridge.js";
import {preferences,setupPreferences} from './preferences.js';
import {setupScreenshot} from './screenshot.js';
import {setupNetwork, bindGameNetwork} from './network.js?v=20260917-7';
const networkOptions = setupNetwork();
import {mappedKey,setupKeySettings} from './key-settings.js';
let communitySource = null;

import { LibMedia } from "../libmedia/libmedia.js";
import { LibMidi, createUnlockingAudioContext } from "../libmidi/libmidi.js";
import { codeMap, KeyRepeatManager } from "./key.js";
import { EventQueue } from "./eventqueue.js";
import { initKbdListeners, setKbdHandler } from "./screenKbd.js";

import { initLayout, fitScale } from "./layout.js";

// we need to import natives here, don't use System.loadLibrary
// since CheerpJ fails to load them in firefox and we can't set breakpoints
import canvasFontNatives from "../libjs/libcanvasfont.js";
import canvasGraphicsNatives from "../libjs/libcanvasgraphics.js";
import gles2Natives from "../libjs/libgles2.js";
import jsReferenceNatives from "../libjs/libjsreference.js";
import mediaBridgeNatives from "../libjs/libmediabridge.js";
import midiBridgeNatives from "../libjs/libmidibridge.js";

const evtQueue = new EventQueue();
const sp = new URLSearchParams(location.search);

const cheerpjWebRoot = '/app'+new URL('..', import.meta.url).pathname.replace(/\/$/,'');


let display = null;
let screenCtx = null;

let fractionScale = sp.get('fractionScale') || (localStorage && localStorage.getItem("pl.zb3.freej2me.fractionScale") === "true");
let scaleSet = false;

const keyRepeatManager = new KeyRepeatManager();

window.evtQueue = evtQueue;

function autoscale() {
    if (!scaleSet) return;

    const area = document.getElementById('screen-area');
    display.style.zoom = fitScale(area.clientWidth, area.clientHeight,
        screenCtx.canvas.width, screenCtx.canvas.height, fractionScale)*preferences.zoom;

}

function setListeners() {
    setupPreferences(autoscale);setupScreenshot();setupKeySettings();
    let mouseDown = false;
    let noMouse = false;
    function point(clientX, clientY) {
        const rect = display.getBoundingClientRect();
        return {
            x: Math.floor((clientX - rect.left) * display.width / rect.width),
            y: Math.floor((clientY - rect.top) * display.height / rect.height)
        };
    }

    setKbdHandler((isDown, key) => {
        const symbol = key.startsWith('Digit') ? key.substring(5) : '\x00';
        keyRepeatManager.post(isDown, key, {symbol, ctrlKey: false, shiftKey: false});
    });

    setupGamepad(display,(isDown,key)=>keyRepeatManager.post(isDown,key,{symbol:key.startsWith('Digit')?key.slice(5):'\x00',ctrlKey:false,shiftKey:false}));
    const handleTextInput = setupTextInput(display, evtQueue);
    function handleKeyEvent(e) {
        if (handleTextInput(e)) return;
        const isDown = e.type === 'keydown';
        const code=mappedKey(e.code);

        if (codeMap[code]) {
            keyRepeatManager.post(isDown, code, {
                symbol: code === e.code ? (e.key.length === 1 ? e.key : '\x00') : code.startsWith('Digit') ? code.slice(5) : code.startsWith('Key') ? code.slice(3).toLowerCase() : code === 'Space' ? ' ' : '\x00',
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey
            })
        }
        if (codeMap[code]) e.preventDefault();
    }

    display.addEventListener('keydown', handleKeyEvent);
    display.addEventListener('keyup', handleKeyEvent);

    keyRepeatManager.register((kind, key, args) => {
        if (kind === 'click') {
            if (key === 'Maximize') {
                fractionScale = !fractionScale;
                localStorage && localStorage.setItem("pl.zb3.freej2me.fractionScale", fractionScale);
                autoscale();
            }
        } else if (codeMap[key]) {
            evtQueue.queueEvent({
                kind: kind === 'up' ? 'keyup' : 'keydown',
                args: [codeMap[key], args.symbol, args.ctrlKey, args.shiftKey]
            });
        }
    });

    display.addEventListener('mousedown', async e => {
        display.focus();
        if (noMouse) return;

        evtQueue.queueEvent({
            kind: 'pointerpressed',
            ...point(e.clientX, e.clientY),
        });

        mouseDown = true;

        e.preventDefault();
    });

    display.addEventListener('mousemove', async e => {
        if (noMouse) return;
        if (!mouseDown) return;

        evtQueue.queueEvent({
            kind: 'pointerdragged',
            ...point(e.clientX, e.clientY),
        });

        e.preventDefault();
    });

    document.addEventListener('mouseup', async e => {
        if (noMouse) return;
        if (!mouseDown) return;

        mouseDown = false;

        evtQueue.queueEvent({
            kind: 'pointerreleased',
            ...point(e.clientX, e.clientY),
        });

        e.preventDefault();
    });


    display.addEventListener('touchstart', async e => {
        display.focus();
        noMouse = true;

        evtQueue.queueEvent({
            kind: 'pointerpressed',
            ...point(e.changedTouches[0].clientX, e.changedTouches[0].clientY),
        });

        e.preventDefault();
    }, {passive: false});

    display.addEventListener('touchmove', async e => {
        noMouse = true;

        evtQueue.queueEvent({
            kind: 'pointerdragged',
            ...point(e.changedTouches[0].clientX, e.changedTouches[0].clientY),
        });

        e.preventDefault();
    }, {passive: false});

    display.addEventListener('touchend', async e => {
        noMouse = true;

        evtQueue.queueEvent({
            kind: 'pointerreleased',
            ...point(e.changedTouches[0].clientX, e.changedTouches[0].clientY),
        });

        e.preventDefault();
    });

    window.addEventListener('resize', autoscale);

    initKbdListeners();
    initLayout(() => {
        for (const [key, state] of keyRepeatManager.keyStates) {
            keyRepeatManager.post(false, key, state.args);
        }
        requestAnimationFrame(autoscale);
    });
    new ResizeObserver(autoscale).observe(document.getElementById('screen-area'));
}

function setFaviconFromBuffer(arrayBuffer) {
    const blob = new Blob([arrayBuffer], { type: 'image/png' });

    const reader = new FileReader();
    reader.onload = function() {
        const dataURL = reader.result;

        let link = document.querySelector("link[rel*='icon']");
        if (!link) {
            link = document.createElement('link');
            link.setAttribute('rel', 'icon');
            document.head.appendChild(link);
        }
        link.setAttribute('href', dataURL);
    };
    reader.readAsDataURL(blob);
}

async function ensureAppInstalled(lib, appId) {
    const appFile = await cjFileBlob("/files/" + appId + "/app.jar");

    if (!appFile) {
        const launcherUtil = await lib.pl.zb3.freej2me.launcher.LauncherUtil;

        await launcherUtil.installFromBundle(cheerpjWebRoot + "/apps/", appId);
    }
}

async function init() {
    const app = sp.get('app') || '';
    if (app.startsWith('community_')) {
        const id = communityGameId(app);
        if (!id) throw new Error('Mã game không hợp lệ.');
        const context = await resolveCommunityGame(id);
        if (context.appId !== app) throw new Error('Hãy mở game từ tài khoản của bạn.');
        communitySource = context;
    }
    document.getElementById("loading").textContent = "Đang khởi động Java…";

    display = document.getElementById('display');
    screenCtx = display.getContext('2d');

    setListeners();

    window.libmidi = new LibMidi(createUnlockingAudioContext());
    await window.libmidi.init();
    window.libmidi.midiPlayer.addEventListener('end-of-media', e => {
        window.evtQueue.queueEvent({kind: 'player-eom', player: e.target});
    })
    window.libmedia = new LibMedia();

    await cheerpjInit({
        ...networkOptions,
        enableDebug: false,
        natives: {
            ...relayNatives,
            ...canvasFontNatives,
            ...canvasGraphicsNatives,
            ...gles2Natives,
            ...jsReferenceNatives,
            ...mediaBridgeNatives,
            ...midiBridgeNatives,
            async Java_pl_zb3_freej2me_bridge_shell_Shell_setTitle(lib, title) {
                document.title = title;
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_setIcon(lib, iconBytes) {
                if (iconBytes) {
                    setFaviconFromBuffer(iconBytes.buffer);
                }
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_getScreenCtx(lib) {
                return screenCtx;
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_setCanvasSize(lib, width, height) {
                if (!scaleSet) {
                    document.getElementById('loading').hidden = true;
                    display.style.display = '';
                    scaleSet = true;
                    try{const appId=sp.get('app');if(appId)localStorage.setItem('java-emulator.last-played:'+appId,String(Date.now()));}catch{}
                    if (communitySource?.user) recordPlay(communitySource.game.id);
                    display.focus();
                }
                screenCtx.canvas.width = width;
                screenCtx.canvas.height = height;
                autoscale();
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_waitForAndDispatchEvents(lib, listener) {
                const KeyEvent = await lib.pl.zb3.freej2me.bridge.shell.KeyEvent;
                const PointerEvent = await lib.pl.zb3.freej2me.bridge.shell.PointerEvent;

                const evt = await evtQueue.waitForEvent();
                if (evt.kind === 'textinput') {
                    const TextInput = await lib.org.recompile.freej2me.TextInput;
                    await TextInput.send(evt.code, evt.character);
                } else if (evt.kind == 'keydown') {
                    await listener.keyPressed(await new KeyEvent(...evt.args));
                } else if (evt.kind == 'keyup') {
                    await listener.keyReleased(await new KeyEvent(...evt.args));
                } else if (evt.kind == 'pointerpressed') {
                    await listener.pointerPressed(await new PointerEvent(evt.x, evt.y));
                } else if (evt.kind == 'pointerdragged') {
                    await listener.pointerDragged(await new PointerEvent(evt.x, evt.y));
                } else if (evt.kind == 'pointerreleased') {
                    await listener.pointerReleased(await new PointerEvent(evt.x, evt.y));
                } else if (evt.kind == 'player-eom') {
                    await listener.playerEOM(evt.player);
                } else if (evt.kind == 'player-video-frame') {
                    await listener.playerVideoFrame(evt.player);
                }
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_restart(lib) {
                location.reload();
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_exit(lib) {
                window.dispatchEvent(new CustomEvent('game-startup-status',{detail:'Ứng dụng đã yêu cầu thoát'}));
                console.info('MIDlet requested exit (notifyDestroyed).');
                const loading = document.getElementById('loading');
                if (display) display.style.display = 'none';
                loading.hidden = false;
                loading.style.display = '';
                loading.replaceChildren(document.createTextNode('Ứng dụng đã kết thúc. '));
                const restart = document.createElement('button');
                restart.type = 'button';
                restart.textContent = 'Chạy lại';
                restart.onclick = () => location.reload();
                const library = document.createElement('a');
                library.href = '/library';
                library.textContent = 'Về thư viện';
                loading.append(restart, ' ', library);
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_sthop(lib) {
                debugger;
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_say(lib, sth) {
                console.log('[say]', sth);
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_sayObject(lib, label, obj) {
                debugger;
                console.log('[sayobject]', label, obj);
            }
        }
    });

    document.getElementById("loading").textContent = "Đang mở game…";

    window.dispatchEvent(new CustomEvent('game-startup-status',{detail:'Đang nạp bộ giả lập'}));
    const lib = await cheerpjRunLibrary(cheerpjWebRoot+"/freej2me-web-relay-v3.jar");

    await bindGameNetwork(await lib.javax.microedition.io.NetworkControl);
    const FreeJ2ME = await lib.org.recompile.freej2me.FreeJ2ME;

    let args;

    if (sp.get('app')) {
        const app = sp.get('app');
        await ensureAppInstalled(lib, app);

        document.addEventListener('click', async event => {
            const link=event.target.closest('a[href="/library"]');
            if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.button!==0)return;
            event.preventDefault();if(link.dataset.saving)return;link.dataset.saving='true';
            try {const saves=await lib.org.recompile.freej2me.GameSave;await saves.checkpoint(app);location.href='/library';}
            catch {delete link.dataset.saving;if(await confirmAction('Không tạo được mốc bản lưu. Vẫn về thư viện?'))location.href='/library';}
        });
        args = ['app', sp.get('app')];
    } else {
        args = ['jar', cheerpjWebRoot+"/jar/" + (sp.get('jar') || "game.jar")];
    }

    window.dispatchEvent(new CustomEvent('game-startup-status',{detail:'Đã chuyển quyền chạy cho ứng dụng'}));
    await FreeJ2ME.main(args);


}

init().catch(error => {
    window.dispatchEvent(new CustomEvent('game-startup-status',{detail:'Lỗi khi khởi động; xem Console để biết chi tiết'}));
    console.error(error);
    const loading = document.getElementById('loading');
    loading.hidden = false;
    if (display) display.style.display = 'none';
    loading.textContent = error.message || 'Không khởi động được game. Hãy quay về thư viện và thử lại.';
});
