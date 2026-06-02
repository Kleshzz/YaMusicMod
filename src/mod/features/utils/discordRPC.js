const { BrowserWindow } = require("electron");
const { Client } = require("@xhayper/discord-rpc");

const CLIENT_ID = "1283109459463377011";
const UPDATE_INTERVAL = 2000;

let client;
let lastTrackId = null;
let lastIsPlaying = null;

function initRpc() {
  client = new Client({ clientId: CLIENT_ID });

  client.login().catch((e) => {
    console.error("[DISCORD RPC]", e);
    setTimeout(initRpc, 5000);
  });

  client.on("ready", () => {
    console.log("[DISCORD RPC] Hooked!", client.user?.username);
    lastTrackId = null;
    lastIsPlaying = null;
  });

  ["disconnected", "error", "close"].forEach((ev) => {
    client.on(ev, () => {
      console.log(`[DISCORD RPC] ${ev}`);
      setTimeout(initRpc, 5000);
    });
  });
}

async function updateActivity() {
  setTimeout(updateActivity, UPDATE_INTERVAL);

  if (!client?.user) return;

  try {
    const playerState = await GetAppPlayerState();
    console.log("[DISCORD RPC] playerState:", JSON.stringify(playerState));

    if (!playerState?.enabled) {
      client.user.clearActivity();
      return;
    }

    const data = playerState.data;

    if (!data || !data.isPlaying) {
      if (lastIsPlaying !== false) {
        client.user.clearActivity();
        lastIsPlaying = false;
        lastTrackId = null;
      }
      return;
    }

    const trackId = data.trackMeta.id;
    const isPlaying = data.isPlaying;

    // обновляем только если трек сменился или статус изменился
    if (trackId === lastTrackId && isPlaying === lastIsPlaying) return;

    lastTrackId = trackId;
    lastIsPlaying = isPlaying;

    const startTimestamp = Math.round(Date.now() - data.playback.position * 1000);
    const endTimestamp = Math.round(Date.now() + (data.playback.duration - data.playback.position) * 1000);

    const coverUrl = data.trackMeta.coverUri
      ? data.trackMeta.coverUri.startsWith('http')
        ? data.trackMeta.coverUri
        : `https://${data.trackMeta.coverUri.replaceAll("%%", "300x300")}`
      : undefined;

    const rpcRequest = {
      type: 2,
      details: data.trackMeta.version
        ? `${data.trackMeta.title} ${data.trackMeta.version}`
        : data.trackMeta.title,
      state: data.trackMeta.artists.map((a) => a.name).join(", "),
      largeImageKey: coverUrl,
      startTimestamp,
      endTimestamp,
      buttons: [
        {
          label: "🎵 Открыть",
          url: `https://music.yandex.ru/track/${trackId}`,
        },
      ],
      instance: false,
    };

    if (playerState.showModButton) {
      rpcRequest.buttons.push({
        label: "💻 Yandex Music Mod",
        url: "https://github.com/Stephanzion/YandexMusicBetaMod",
      });
    }

    client.user.setActivity(rpcRequest);
  } catch (ex) {
    console.log("[DISCORD RPC]", ex);
  }
}

initRpc();
updateActivity();

async function GetAppPlayerState() {
  const [win] = BrowserWindow.getAllWindows();
  if (win && !win.isDestroyed()) {
    if (process.argv.includes('--dev-tools') && !win.webContents.isDevToolsOpened()) {
      win.webContents.openDevTools();
    }
    try {
      return await win.webContents.executeJavaScript(`
        (()=>{
          if (typeof window.__getPlayerState !== 'function') return undefined;
          return window.__getPlayerState();
        })()
      `);
    } catch (e) {
      return undefined;
    }
  }
}
