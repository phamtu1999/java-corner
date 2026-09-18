import {confirmAction,showMessage} from '../../ui/dialogs.js';
import {iconButton,compactGameActions} from './library-icons.js';
import {addUpdateCheck} from './catalog-updates.js';
import {addGameBackup} from './game-backups.js';
import { currentUser, communityAppId, communityGameId, resolveCommunityGame } from "./community-bridge.js";
import {setupCloudSave} from './cloud-save.js?v=20260917-2';
let communityUser = null;
import {downloadGame} from './download-progress.js';

// note that we can only call java stuff if thread not running..
const cheerpjWebRoot = '/app'+new URL('..', import.meta.url).pathname.replace(/\/$/,'');

const emptyIcon = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

let lib = null, launcherUtil = null;
let state = {
    games: [],
    currentGame: null,
    editedGameId: null,
    uploadedJars: 0,
};
let defaultSettings = {};
let libraryQuery='',libraryRecent=false,libraryBusy=false;
function normalizeSearch(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d');}
const selectedGames=new Set();
function lastPlayed(appId){try{return Number(localStorage.getItem('java-emulator.last-played:'+appId))||0;}catch{return 0;}}
function setupLibraryTools(){
 iconButton(document.getElementById('clear-current'),'update','Chọn lại tệp game');
 const tools=document.createElement('div');tools.className='library-tools';
 tools.innerHTML='<input type="search" data-search aria-label="Tìm game đã cài" placeholder="Tìm game đã cài…"><button type="button" data-recent aria-pressed="false">Đã chơi trong 7 ngày</button><button type="button" data-measure>Xem dung lượng</button><button type="button" data-select>Chọn kết quả đang hiện</button><button type="button" data-remove disabled>Gỡ đã chọn</button><p data-storage role="status"></p>';
 document.querySelector('#game-list').before(tools);
 tools.querySelector('[data-search]').oninput=e=>{libraryQuery=normalizeSearch(e.currentTarget.value.trim());fillGamesList(state.games);};
 for(const [selector,icon] of [['[data-recent]','recent'],['[data-measure]','storage'],['[data-select]','select'],['[data-remove]','remove']])iconButton(tools.querySelector(selector),icon);
 tools.querySelector('[data-recent]').onclick=e=>{libraryRecent=!libraryRecent;e.currentTarget.setAttribute('aria-pressed',String(libraryRecent));fillGamesList(state.games);};
 for(const [value,label] of [['recent','Chơi gần nhất'],['size','Dung lượng giảm dần']]){const o=document.createElement('option');o.value=value;o.textContent=label;gameSort.append(o);}
 try{gameSort.value=localStorage.getItem('library-sort')||'installed';}catch{}
 const status=tools.querySelector('[data-storage]');
 tools.querySelector('[data-measure]').onclick=async e=>{e.currentTarget.disabled=true;const control=e.currentTarget;try{status.textContent='Đang đo dung lượng tệp game…';for(const game of state.games){const blob=await cjFileBlob('/files/'+game.appId+'/app.jar');game.bytes=blob?.size||0;}const estimate=await navigator.storage?.estimate?.();status.textContent=`Tệp game: ${(visibleGames(state.games).reduce((n,g)=>n+(g.bytes||0),0)/1048576).toFixed(1)} MB.${estimate?` Toàn bộ dữ liệu website: khoảng ${(estimate.usage/1048576).toFixed(1)} MB.`:''} Dung lượng từng hàng chỉ tính tệp JAR, chưa gồm tiến trình.`;fillGamesList(state.games);}catch(error){status.textContent=error.message;}finally{control.disabled=false;}};
 gameSort.addEventListener('change',()=>{if(gameSort.value==='size')tools.querySelector('[data-measure]').click();});
 fillGamesList(state.games);
 tools.querySelector('[data-select]').onclick=()=>{const visible=visibleGames(state.games);const all=visible.length&&visible.every(g=>selectedGames.has(g.appId));for(const g of visible){if(all)selectedGames.delete(g.appId);else selectedGames.add(g.appId);}fillGamesList(state.games);};
 tools.querySelector('[data-remove]').onclick=async()=>{const targets=state.games.filter(g=>selectedGames.has(g.appId));if(!targets.length||libraryBusy||!await confirmRemoveGame(targets.map(g=>g.name).join(', ')))return;libraryBusy=true;tools.inert=true;document.querySelector('#game-list').inert=true;let removed=0;try{for(const g of targets){await launcherUtil.uninstallApp(g.appId);selectedGames.delete(g.appId);removed++;}status.textContent=`Đã gỡ ${removed} game.`;}catch(error){status.textContent=`Đã gỡ ${removed} game. ${error.message}`;}finally{try{await reloadUI();}catch(error){status.textContent+=' Không thể tải lại danh sách: '+error.message;}finally{libraryBusy=false;tools.inert=false;document.querySelector('#game-list').inert=false;}}};
}
function visibleGames(games){return games.filter(game=>{if(game.appId.startsWith('community_')){const source=communityGameId(game.appId);if(!source||game.appId!==communityAppId(source,communityUser))return false;}return normalizeSearch(game.name).includes(libraryQuery)&&(!libraryRecent||lastPlayed(game.appId)>Date.now()-7*86400000);});}

async function main() {
    const userReady=currentUser().then(user=>{communityUser=user;}).catch(()=>{});
    const controls=[...document.querySelectorAll('#main button,#main input,#main select')];
    const disabled=controls.map(control=>control.disabled);
    controls.forEach(control=>control.disabled=true);
    document.getElementById('main').style.display='';
    document.getElementById('main').setAttribute('aria-busy','true');
    document.getElementById('game-list').textContent='Đang đọc game đã cài…';
    document.getElementById("loading").textContent = "Đang tải bộ chạy Java…";
    await cheerpjInit({
        enableDebug: false
    });

    lib = await cheerpjRunLibrary(cheerpjWebRoot+"/freej2me-web-relay-v3.jar");

    document.getElementById("loading").textContent = "Đang mở thư viện…";

    launcherUtil = await lib.pl.zb3.freej2me.launcher.LauncherUtil;

    await launcherUtil.resetTmpDir();

    const Config = await lib.org.recompile.freej2me.Config;
    await javaToKv(Config.DEFAULT_SETTINGS, defaultSettings);

    await userReady;
    await reloadUI();
    setupLibraryTools();
    controls.forEach((control,i)=>control.disabled=disabled[i]);
    document.getElementById('main').removeAttribute('aria-busy');

    document.getElementById("loading").style.display = "none";
    document.getElementById("main").style.display = "";

    document.getElementById("clear-current").onclick = setupAddMode;

    document.getElementById("import-data-btn").addEventListener("click", () => {
        document.getElementById("import-data-file").click();
    });

    document.getElementById("import-data-file").onchange = doImportData;
    document.getElementById("export-data-btn").onclick = doExportData;
    setupCloudSave({user:communityUser,exportData:()=>launcherUtil.exportData(),importData:bytes=>launcherUtil.importData(bytes),reload:reloadUI,getGames:()=>visibleGames(state.games),restoreGame:async(bytes,id)=>{
      const path='/str/game-save-'+Date.now()+'.zip';cheerpOSAddStringFile(path,new Uint8Array(bytes));
      try{const saves=await lib.org.recompile.freej2me.GameSave;await saves.restore(path,id);}
      catch(error){let message='Không thể khôi phục game từ bản lưu đã chọn.';try{message=await error.getMessage();}catch{}throw new Error(message);}
      finally{cheerpOSRemoveStringFile(path);}
    }});

    const gameId = new URLSearchParams(location.search).get("game");
    if (gameId) await openCommunityGame(gameId);
}

async function maybeReadCheerpJFileText(path) {
    const blob = await cjFileBlob(path);
    if (blob) {
        return await blob.text();
    }
}

async function getDataUrlFromBlob(blob) {
    const reader = new FileReader();

    const promise = new Promise((r) => {
        reader.onload = function () {
            r(reader.result);
        };
    });

    reader.readAsDataURL(blob);
    return await promise;
}

function readToKv(txt, kv) {
    for (const line of txt.trim().split("\n").filter(Boolean)) {
        const parts = line.split(/\s*:\s*/);
        if (parts.length == 2) {
            kv[parts[0]] = parts[1];
        }
    }
}

async function javaToKv(hashMap, kv) {
    const es = await hashMap.entrySet();
    const esi = await es.iterator();

    while (await esi.hasNext()) {
        const entry = await esi.next();
        const key = await entry.getKey();
        const value = await entry.getValue();

        kv[key] = value;
    }
}

async function kvToJava(kv) {
    const HashMap = await lib.java.util.HashMap;
    const ret = await new HashMap();

    for (const k of Object.keys(kv)) {
        await ret.put(k, kv[k]);
    }

    return ret;
}

async function loadGames() {
    const apps = [];

    let installedAppsBlob = await cjFileBlob("/files/apps.list");
    if (installedAppsBlob) {
        const installedIds = (await installedAppsBlob.text()).trim().split("\n").filter(Boolean);

        for (const appId of installedIds) {
            const napp = {
                appId,
                name: appId,
                icon: emptyIcon,
                settings: { ...defaultSettings },
                appProperties: {},
                systemProperties: {},
            };

            const base='/files/'+appId;
            const [name,iconBlob,...configs]=await Promise.all([
                maybeReadCheerpJFileText(base+'/name'),cjFileBlob(base+'/icon'),
                ...['settings','appproperties','systemproperties'].map(file=>maybeReadCheerpJFileText(base+'/config/'+file+'.conf'))
            ]);
            if (name) napp.name = name;

            if (iconBlob) {
                const dataUrl = await getDataUrlFromBlob(iconBlob);
                if (dataUrl) {
                    napp.icon = dataUrl;
                }
            }

            for (const [index,keyName] of ['settings','appProperties','systemProperties'].entries()) {
                const content = configs[index];
                if (content) {
                    readToKv(content, napp[keyName]);
                }
            }

            apps.push(napp);
        }
    }

    return apps;
}

const gameSort = document.getElementById('game-sort');
try { gameSort.value = localStorage.getItem('library-sort') || 'installed'; } catch {}
gameSort.addEventListener('change', () => {
    try { localStorage.setItem('library-sort', gameSort.value); } catch {}
    fillGamesList(state.games || []);
});

function confirmRemoveGame(name) {
    return new Promise(resolve => {
        const dialog = document.createElement('dialog');
        dialog.className = 'remove-game-dialog';
        dialog.setAttribute('aria-labelledby', 'remove-game-title');
        dialog.setAttribute('aria-describedby', 'remove-game-description');
        dialog.innerHTML = '<form method="dialog"><h2 id="remove-game-title">Gỡ game khỏi máy?</h2><p class="remove-game-name"></p><p id="remove-game-description">Gỡ bản game trong trình duyệt này. Hãy xuất bản lưu trước nếu muốn giữ dữ liệu game.</p><p class="remove-game-note">Game trong kho công khai vẫn được giữ lại.</p><div class="remove-game-actions"><button value="cancel" autofocus>Hủy</button><button value="remove" class="confirm-remove">Gỡ game</button></div></form>';
        dialog.querySelector('.remove-game-name').textContent = name;
        const previousFocus = document.activeElement;
        dialog.addEventListener('close', () => {
            const confirmed = dialog.returnValue === 'remove';
            dialog.remove();
            previousFocus?.focus();
            resolve(confirmed);
        }, {once:true});
        document.body.append(dialog);
        dialog.showModal();
    });
}

async function removeInstalledGame(game, control) {
    if (!await confirmDiscard()) return;
    if (!await confirmRemoveGame(game.name)) return;
    control.disabled = true;
    try { await doUninstallGame(game.appId); }
    catch (error) { await showMessage('Không thể gỡ game: ' + error.message); control.disabled = false; }
}

function fillGamesList(games) {
    games = visibleGames(games);
    if(gameSort.value==='recent')games.sort((a,b)=>lastPlayed(b.appId)-lastPlayed(a.appId));
    if(gameSort.value==='size')games.sort((a,b)=>(b.bytes||0)-(a.bytes||0));
    if (gameSort.value === 'az' || gameSort.value === 'za') {
        const direction = gameSort.value === 'az' ? 1 : -1;
        games.sort((a,b) => direction * a.name.localeCompare(b.name, 'vi', {numeric:true, sensitivity:'base'}));
    }
    const container = document.getElementById("game-list");
    container.textContent = games.length ? "" : "Chưa có game. Thêm tệp .jar để bắt đầu bộ sưu tập.";

    document.getElementById("installed-count").textContent = games.length;

    for (const game of games) {
        const item = document.createElement("div");
        item.className = "game-item";
        const select=document.createElement('input');select.type='checkbox';select.checked=selectedGames.has(game.appId);select.setAttribute('aria-label','Chọn '+game.name);select.onchange=()=>{if(select.checked)selectedGames.add(game.appId);else selectedGames.delete(game.appId);updateSelection();};item.append(select);

        const link = document.createElement("a");
        link.className = "game-entry";
        link.target = "_blank";
        link.rel = "noopener";
        link.href = "/play?app=" + encodeURIComponent(game.appId) + "&fractionScale=1";


        const icon = document.createElement("img");
        icon.className = "icon";
        icon.src = game.icon;
        icon.alt = "";
        link.appendChild(icon);

        const info = document.createElement("div");
        info.className = "game-info";
        info.textContent = game.name;
        const hint = document.createElement("small");
        hint.className = "game-play-hint";
        hint.textContent = "▶ Chơi bằng bàn phím";
        if(game.bytes!==undefined)hint.textContent+=` · ${(game.bytes/1048576).toFixed(1)} MB`;
        info.appendChild(hint);
        link.setAttribute("aria-label", "Chơi bằng bàn phím: " + game.name);
        link.appendChild(info);

        item.appendChild(link);
        const touchLink = document.createElement("a");
        touchLink.href = link.href + "&mobile=1";
        touchLink.className = "game-action touch-action";
        touchLink.target = "_blank";
        touchLink.rel = "noopener";
        touchLink.innerHTML = '<svg class="launcher-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 4 12 8-12 8Z"/></svg><span>Chơi game</span>';
        touchLink.setAttribute("aria-label", "Chơi game: " + game.name);
        item.appendChild(touchLink);

        const manageButton = document.createElement("button");
        manageButton.className = "game-action settings-action";
        manageButton.setAttribute("aria-label", "Cài đặt: " + game.name);
        manageButton.innerHTML = '<svg class="launcher-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="white"/><circle cx="16" cy="17" r="3" fill="white"/></svg><span>Cài đặt</span>';
        manageButton.onclick = () => openEditGame(game);
        item.appendChild(manageButton);
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'game-action remove-action';
        removeButton.setAttribute('aria-label', 'Gỡ game: ' + game.name);
        removeButton.innerHTML = '<svg class="launcher-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg><span>Gỡ</span>';
        removeButton.onclick = () => removeInstalledGame(game, removeButton);
        item.appendChild(removeButton);

        addGameBackup(item,game,async()=>await lib.org.recompile.freej2me.GameSave,()=>fillGamesList(state.games));
        const profile=document.createElement('button');profile.className='game-action';profile.textContent='Cấu hình tốt';profile.type='button';
        profile.onclick=()=>{
            const key='java-corner.working-profile:'+game.appId;
            const prefixes=['java-emulator.keys:','java-emulator.layout:','java-emulator.preferences:','java-corner.network-enabled:','java-corner.touch:','java-corner.gamepad:'];
            const dialog=document.createElement('dialog');dialog.className='remove-game-dialog';dialog.innerHTML='<h2>Cấu hình đã chơi tốt</h2><p>Lưu cấu hình đang có của game này: màn hình, điện thoại, phím, cảm ứng và mạng. Chỉ xác nhận sau khi bạn đã chơi thử thành công.</p><button data-save>Lưu cấu hình hiện tại</button><button data-apply>Áp dụng cấu hình đã lưu</button><p role="status"></p><button data-close>Đóng</button>';
            const status=dialog.querySelector('[role=status]');let busy=false;
            dialog.querySelector('[data-save]').onclick=()=>{try{const browser=Object.fromEntries(prefixes.map(p=>[p,localStorage.getItem(p+game.appId)]));localStorage.setItem(key,JSON.stringify({settings:game.settings,browser}));status.textContent='Đã lưu cấu hình đã thử.';}catch{status.textContent='Không lưu được cấu hình.';}};
            dialog.querySelector('[data-apply]').onclick=async()=>{if(busy)return;try{const saved=JSON.parse(localStorage.getItem(key));if(!saved?.settings)throw Error('Chưa lưu cấu hình tốt.');if(!await confirmAction('Thay cấu hình game bằng cấu hình đã lưu?'))return;busy=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);await launcherUtil.saveApp(game.appId,await kvToJava(saved.settings),await kvToJava(game.appProperties),await kvToJava(game.systemProperties));for(const p of prefixes){if(typeof saved.browser?.[p]==='string')localStorage.setItem(p+game.appId,saved.browser[p]);else localStorage.removeItem(p+game.appId);}await reloadUI();status.textContent='Đã áp dụng. Mở lại game để dùng cấu hình.';}catch(e){status.textContent=e.message||'Không áp dụng được cấu hình.';}finally{busy=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}};
            dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.oncancel=e=>{if(busy)e.preventDefault();};dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
        };item.append(profile);
        addUpdateCheck(item,game);
        compactGameActions(item);
        container.appendChild(item);
    }
    updateSelection();
}
function updateSelection(){const button=document.querySelector('[data-remove]');if(button){button.disabled=!selectedGames.size;iconButton(button,'remove',`Gỡ đã chọn (${selectedGames.size})`);}}

async function setupAddMode() {
    if (!await confirmDiscard()) {
        return;
    }
    state.currentGame = {
        icon: emptyIcon,
        settings: { ...defaultSettings },
        appProperties: {},
        systemProperties: {},
    };

    document.getElementById("add-edit-text").textContent = "Thêm game";

    document.getElementById("file-input-step").style.display = "";
    document.getElementById("file-input-loading").style.display = "none";
    document.getElementById("file-input-jad-step").style.display = "none";
    document.getElementById("add-manage-step").style.display = "none";

    document.getElementById("game-file-input").disabled = false;
    document.getElementById("game-file-input").value = null;

    document.getElementById("game-file-input").onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const error = document.getElementById("upload-error");
        error.textContent = "";
        e.target.disabled = true;
        document.getElementById("file-input-loading").style.display = "";
        try {
            if (!/\.jar$/i.test(file.name)) throw new Error("Hãy chọn game Java ME có đuôi .jar.");
            const data = await file.arrayBuffer();
            const bytes = new Uint8Array(data);
            if (bytes[0] !== 80 || bytes[1] !== 75 || bytes[2] !== 3 || bytes[3] !== 4) {
                throw new Error("Tệp không phải gói JAR hợp lệ.");
            }
            await processGameFile(data, file.name);
        } catch (failure) {
            state.currentGame = null;
            setupAddMode();
            error.textContent = failure.message || "Không đọc được game. Hãy chọn tệp JAR khác.";
        } finally {
            e.target.disabled = false;
            document.getElementById("file-input-loading").style.display = "none";
        }
    };
}

async function processGameFile(fileBuffer, fileName) {
    // Community games enter this flow directly, without setupAddMode().
    // Always create the draft game state before CheerpJ starts analysing the JAR.
    if (!state.currentGame) {
        state.currentGame = {
            icon: emptyIcon,
            settings: { ...defaultSettings },
            appProperties: {},
            systemProperties: {},
        };
    }

    const MIDletLoader = await lib.org.recompile.mobile.MIDletLoader;
    const File = await lib.java.io.File;
    // cheerpOSAddStringFile accepts a single file under /str/; it cannot
    // create nested directories such as /files/_tmp/.
    const tempPath = "/str/java-emulator-upload-" + state.uploadedJars++ + ".jar";
    const jarBytes = fileBuffer instanceof Uint8Array
        ? fileBuffer
        : new Uint8Array(fileBuffer instanceof ArrayBuffer ? fileBuffer : fileBuffer.buffer);

    // Avoid LauncherUtil.copyJar's byte[] overload: newer CheerpJ builds can
    // fail to resolve that Java bridge method even though the signature exists.
    cheerpOSAddStringFile(tempPath, jarBytes);
    const jarFile = await new File(tempPath);
    state.currentGame.jarFile = jarFile;

    const AnalyserUtil = await lib.pl.zb3.freej2me.launcher.AnalyserUtil;
    const analysisResult = await AnalyserUtil.analyseFile(jarFile, fileName);
    fillGuessedSettings(analysisResult, state.currentGame);

    if (state.lastLoader) {
        await state.lastLoader.close();
    }
    const loader = await MIDletLoader.getMIDletLoader(jarFile);
    state.lastLoader = loader;

    if (!(await loader.getAppId())) {
        document.getElementById("file-input-step").style.display = "";
        document.getElementById("file-input-loading").style.display = "none";
        document.getElementById("file-input-jad-step").style.display = "";
        document.getElementById("upload-descriptor-file-input").value = null;

        document.getElementById("upload-descriptor-file-input").onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById("file-input-step").style.display = "none";
                document.getElementById("file-input-jad-step").style.display = "none";
                document.getElementById("file-input-loading").style.display = "";

                const reader = new FileReader();
                reader.onload = async () => {
                    const arrayBuffer = reader.result;
                    await launcherUtil.augementLoaderWithJAD(
                        loader,
                        new Int8Array(arrayBuffer)
                    );

                    if (await loader.getAppId()) {
                        await setupNewGameManage(loader);
                    }
                };
                reader.readAsArrayBuffer(file);
            }
        };

        document.getElementById('continue-without-jad').onclick = () => {
            continueWithoutJAD(loader, fileName);
        };
    } else {
        await setupNewGameManage(loader);
    }
}

function fillGuessedSettings(analysisResult, app) {
    if (analysisResult.screenWidth !== -1) {
        app.settings.width = analysisResult.screenWidth + '';
        app.settings.height = analysisResult.screenHeight + '';
    }

    if (analysisResult.phoneType) {
        app.settings.phone = analysisResult.phoneType;
    }
}

async function continueWithoutJAD(loader, origName) {
    // if we're here then need fallback name
    await launcherUtil.ensureAppId(loader, origName);
    loader.name = await loader.getAppId();

    await setupNewGameManage(loader);
}

async function setupNewGameManage(loader) {
    state.currentGame.appId = await loader.getAppId();
    state.currentGame.name = loader.name || state.currentGame.appId;
    const iconBytes = await loader.getIconBytes();
    state.currentGame.icon = iconBytes
        ? await getDataUrlFromBlob(new Blob([iconBytes]))
        : emptyIcon;

    await javaToKv(loader.properties, state.currentGame.appProperties);

    setupAddManageGame(state.currentGame, true);
}

async function setupAddManageGame(app, isAdding) {
    document.getElementById("file-input-step").style.display = "none";
    document.getElementById("file-input-jad-step").style.display = "none";
    document.getElementById("file-input-loading").style.display = "none";
    document.getElementById("add-manage-step").style.display = "";

    const previewIcon = document.querySelector(".preview-icon");
    previewIcon.src = app.icon || emptyIcon;

    const previewName = document.querySelector(".preview-name");
    previewName.textContent = app.name;

    const previewControls = document.getElementById("preview-controls");
    previewControls.style.display = isAdding ? "none" : "";
    if (!isAdding) {
        document.getElementById("uninstall-btn").disabled = false;
        document.getElementById("uninstall-btn").onclick = e => removeInstalledGame(app, e.currentTarget);

        document.getElementById("wipe-data-btn").disabled = false;
        document.getElementById("wipe-data-btn").onclick = async (e) => {
            if (!await confirmAction("Xóa tiến trình của " + app.name + "?")) {
                return;
            }

            document.getElementById("wipe-data-btn").disabled = true;
            doWipeData(app.appId);
        };
    }

    const jadFileInput = document.getElementById("aux-jad-file-input");
    jadFileInput.value = null;
    jadFileInput.onchange = handleOptionalJadFileUpload;

    const phoneType = document.getElementById("phoneType");
    phoneType.value = app.settings.phone;
    let fps=document.getElementById('game-fps');
    if(!fps){const label=document.createElement('label');label.textContent='Giới hạn tốc độ khung hình';fps=document.createElement('select');fps.id='game-fps';fps.innerHTML='<option value="0">Không giới hạn</option><option value="15">15 FPS</option><option value="30">30 FPS</option><option value="60">60 FPS</option>';label.append(fps);document.querySelector('.settings-grid').append(label);}
    fps.value=app.settings.fps||'0';

    const screenSize = document.getElementById("screenSize");

    const sizeStr = `${app.settings.width}x${app.settings.height}`;
    if ([...screenSize.options].some((opt) => opt.value === sizeStr)) {
        screenSize.value = sizeStr;
    } else {
        screenSize.value = "custom";
    }
    document.getElementById("customWidth").value = app.settings.width;
    document.getElementById("customHeight").value = app.settings.height;
    screenSize.onchange = adjustScreenSizeInput;
    adjustScreenSizeInput();

    const fontSize = document.getElementById("fontSize");
    if (app.settings.fontSize) {
        fontSize.value = app.settings.fontSize;
    }

    const dgFormat = document.getElementById("dgFormat");
    if (app.settings.dgFormat) {
        dgFormat.value = app.settings.dgFormat;
    }

    document.querySelector('input[name="enableSound"]').checked = app.settings.sound === "on";
    document.querySelector('input[name="rotate"]').checked = app.settings.rotate === "on";
    document.querySelector('input[name="forceFullscreen"]').checked = app.settings.forceFullscreen === "on";
    document.querySelector('input[name="textureDisableFilter"]').checked = app.settings.textureDisableFilter === "on";
    document.querySelector('input[name="queuedPaint"]').checked = app.settings.queuedPaint === "on";

    const appPropsTextarea = document.getElementById("editAppProps");
    appPropsTextarea.value = Object.entries(app.appProperties || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");

    const sysPropsTextarea = document.getElementById("editSysProps");
    sysPropsTextarea.value = Object.entries(app.systemProperties || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");

    document.getElementById("add-save-button").disabled = false;
    document.getElementById("add-save-button").textContent = isAdding ? "Thêm game" : "Lưu cài đặt";
    document.getElementById("add-save-button").onclick = doAddSaveGame;
}

function adjustScreenSizeInput() {
    document.getElementById("edit-custom-size-inputs").style.display =
        document.getElementById("screenSize").value === "custom" ? "" : "none";
}

function handleOptionalJadFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById("add-manage-step").style.display = "none";
    document.getElementById("file-input-loading").style.display = "";

    // read as text?
    const reader = new FileReader();
    reader.onload = async () => {
        // this won't affect the name/id
        readToKv(reader.result, state.currentGame.appProperties);

        const appPropsTextarea = document.getElementById("editAppProps");
        appPropsTextarea.value = Object.entries(
            state.currentGame.appProperties || {}
        )
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n");
    };
    reader.onloadend = () => {
        document.getElementById("add-manage-step").style.display = "";
        document.getElementById("file-input-loading").style.display = "none";
    };
    reader.readAsText(file);
}

async function doAddSaveGame() {
    document.getElementById("add-save-button").disabled = true;

    readUI(state.currentGame);

    const jsettings = await kvToJava(state.currentGame.settings);
    const jappProps = await kvToJava(state.currentGame.appProperties);
    const jsysProps = await kvToJava(state.currentGame.systemProperties);

    if (state.currentGame.jarFile) {
        // new game
        await launcherUtil.initApp(
            state.currentGame.jarFile,
            state.lastLoader, // loader with added properties, for name..
            jsettings,
            jappProps,
            jsysProps
        );
    } else {
        await launcherUtil.saveApp(
            state.currentGame.appId,
            jsettings,
            jappProps,
            jsysProps
        );
    }

    await reloadUI();
}

function readUI(targetGameObj) {
    targetGameObj.settings.phone = document.getElementById("phoneType").value;
    targetGameObj.settings.fps = document.getElementById('game-fps').value;

    const screenSize = document.getElementById("screenSize").value;
    if (screenSize === "custom") {
        targetGameObj.settings.width = document.getElementById("customWidth").value;
        targetGameObj.settings.height = document.getElementById("customHeight").value;
    } else {
        const [width, height] = screenSize.split("x");
        targetGameObj.settings.width = width;
        targetGameObj.settings.height = height;
    }

    targetGameObj.settings.fontSize = document.getElementById("fontSize").value;
    targetGameObj.settings.dgFormat = document.getElementById("dgFormat").value;

    targetGameObj.settings.sound = document.querySelector('input[name="enableSound"]').checked ? "on" : "off";
    targetGameObj.settings.rotate = document.querySelector('input[name="rotate"]').checked ? "on" : "off";
    targetGameObj.settings.forceFullscreen = document.querySelector('input[name="forceFullscreen"]').checked ? "on" : "off";
    targetGameObj.settings.textureDisableFilter = document.querySelector('input[name="textureDisableFilter"]').checked ? "on" : "off";
    targetGameObj.settings.queuedPaint = document.querySelector('input[name="queuedPaint"]').checked ? "on" : "off";

    readToKv(document.getElementById("editAppProps").value, targetGameObj.appProperties);
    readToKv(document.getElementById("editSysProps").value, targetGameObj.systemProperties);
}

async function openEditGame(gameObj) {
    if (!await confirmDiscard()) {
        return;
    }
    state.currentGame = gameObj;
    document.getElementById("add-edit-text").textContent = "Cài đặt game";

    setupAddManageGame(gameObj, false);
}

async function confirmDiscard() {
    if (state.currentGame != null && (state.currentGame.jarFile || state.currentGame.appId)) {
        if (!await confirmAction("Bỏ các thay đổi chưa lưu?")) {
            return false;
        }
    }

    return true;
}

async function reloadUI() {
    state.currentGame = null;

    state.games = await loadGames();
    const installed=new Set(state.games.map(game=>game.appId));
    for(const id of selectedGames)if(!installed.has(id))selectedGames.delete(id);
    fillGamesList(state.games);
    setupAddMode();
}

async function doUninstallGame(appId) {
    await launcherUtil.uninstallApp(appId);
    await reloadUI();
}

async function doWipeData(appId) {
    await launcherUtil.wipeAppData(appId);
    document.getElementById("wipe-data-btn").disabled = false;
}

async function doImportData(e) {
    if (e.target.files.length > 0) {
        if (!await confirmAction('Nhập bản lưu sẽ thay thế toàn bộ dữ liệu game hiện có. Hãy xuất bản lưu trước. Tiếp tục?')) {
            e.target.value = '';
            return;
        }
        document.getElementById("import-data-btn").disabled = true;

        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const arrayBuffer = reader.result;
                await launcherUtil.importData(new Int8Array(arrayBuffer));
                await reloadUI();
            } catch (error) {
                console.error("Error importing data:", error);
            }
        };
        reader.onloadend = () => {
            document.getElementById("import-data-btn").disabled = false;
        };
        reader.readAsArrayBuffer(file);
    }
}

async function doExportData() {
    try {
        const exportedData = await launcherUtil.exportData();
        const blob = new Blob([exportedData.buffer], { type: "application/zip" });

        const objectURL = URL.createObjectURL(blob);
        const downloadLink = document.getElementById("export-data-link");

        downloadLink.href = objectURL;
        downloadLink.click();
        setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
    } catch (error) {
        console.error("Error exporting data:", error);
        await showMessage("Không xuất được bản lưu. Hãy thử lại.");
    }
}

async function openCommunityGame(id) {
    const loading = document.getElementById('loading');
    loading.style.display = '';
    loading.textContent = 'Đang chuẩn bị game từ thư viện…';
    document.getElementById('main').style.display = 'none';
    try {
        const { game, appId } = await resolveCommunityGame(id);
        if (!await cjFileBlob('/files/' + appId + '/app.jar')) {
            const bytes=await downloadGame('/api/games/'+encodeURIComponent(game.id)+'/file',(received,total)=>{loading.textContent=total?`Đang tải game: ${Math.min(100,Math.round(received/total*100))}%`:`Đang tải game: ${(received/1048576).toFixed(1)} MB`;});
            loading.textContent='Đang cài game vào thư viện…';
            await processGameFile(bytes, game.filename);
            await state.lastLoader.setAppId(appId);
            state.currentGame.appId = appId;
            await doAddSaveGame();
            if (!await cjFileBlob('/files/' + appId + '/app.jar')) throw new Error('Chưa cài được game. Hãy thử lại.');
        }
        location.replace('/play?app=' + encodeURIComponent(appId) + '&fractionScale=1&mobile=1');
    } catch (error) {
        console.error('Không thể cài game từ thư viện:', error);
        loading.style.display = 'none';
        document.getElementById('main').style.display = '';
        const message = error?.message || (typeof error === 'string' ? error : 'Không xác định được lỗi khi cài game.');
        const errorBox = document.getElementById('upload-error');
        errorBox.textContent = message;
        const retry=document.createElement('button');
        retry.type = 'button';
        retry.textContent='Thử tải game lại';
        retry.onclick=()=>{retry.remove();openCommunityGame(id);};
        errorBox.append(' ', retry);
    }
}

main().catch(error => {
    console.error(error);
    document.getElementById('loading').textContent = 'Không tải được trình quản lý. Kiểm tra kết nối Internet rồi tải lại trang.';
    const retry=document.createElement('button');retry.textContent='Thử lại';retry.onclick=()=>location.reload();document.getElementById('loading').append(retry);
});
