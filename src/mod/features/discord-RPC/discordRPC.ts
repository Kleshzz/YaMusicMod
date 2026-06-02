import { getTrackMeta, getProgress, isPlaying } from "~/mod/features/utils/player";
import * as Sentry from "@sentry/react";

let isRpcEnabled = true;
let showModButton = true;

// Функция для получения состояния плеера из окна приложения. Её вызывает main процесс - src\mod\main.js
window.__getPlayerState = () => {
  // Vibe плеер
  const vibePlayerbar = document.querySelector('[data-test-id="VIBE_PLAYERBAR"]');
  if (vibePlayerbar) {
    const isPaused = !document.querySelector('[data-test-id="VIBE_PLAYERBAR"] [data-test-id="PAUSE_BUTTON"]');
    if (isPaused) {
      return { enabled: isRpcEnabled, showModButton, data: null };
    }

    const trackNameEl = document.querySelector('[data-test-id="VIBE_PLAYERBAR_TRACK_NAME"]');
    const timecodeEl = document.querySelector('[data-test-id="VIBE_PLAYERBAR_TIMECODE"]');
    const coverEl = document.querySelector('[data-test-id="VIBE_ALBUM_COVER"] img') as HTMLImageElement;

    // objectId из fiber
    let trackId = null;
    let fiberKey = Object.keys(trackNameEl).find(k => k.startsWith('__reactFiber$'));
    if (fiberKey) {
      let node = trackNameEl[fiberKey];
      let count = 0;
      while (node && count < 50) {
        if (node.memoizedProps?.objectId) { trackId = node.memoizedProps.objectId; break; }
        node = node.return;
        count++;
      }
    }

    // artists из aria-label обложки - не подходит
    // берем из VIBE_DYNAMIC_ARTISTS если есть
    const artistsEl = document.querySelector('[data-test-id="VIBE_DYNAMIC_ARTISTS"] [data-test-id="SEPARATED_ARTIST_TITLE"]');
    const artistName = artistsEl?.innerText || 'Яндекс Музыка';

    // таймкод
    const timecode = timecodeEl?.innerText || '';
    const [posStr, durStr] = timecode.split(' / ');
    const parseTime = (s: string) => {
      if (!s) return 0;
      const [m, sec] = s.trim().split(':').map(Number);
      return m * 60 + sec;
    };
    const position = parseTime(posStr);
    const duration = parseTime(durStr);

    const coverUrl = coverEl?.src?.replace('/400x400', '/300x300') || undefined;
    const trackName = trackNameEl?.innerText?.split('\n')[0] || 'Unknown';

    return {
      enabled: isRpcEnabled,
      showModButton,
      data: {
        trackMeta: {
          id: trackId || trackName,
          title: trackName,
          version: null,
          artists: [{ name: artistName }],
          coverUri: coverUrl,
        },
        playback: { position, duration, progress: duration ? position / duration : 0 },
        isPlaying: true,
      },
    };
  }

  // Обычный плеер
  const trackMetaRequest = getTrackMeta();
  const playbackRequest = getProgress();
  const isPlayingRequest = isPlaying();

  if (trackMetaRequest.isErr()) {
    if (trackMetaRequest.error !== "upgrade_promocode") {
      console.error("Error getting track meta:", trackMetaRequest.error);
    }
    return { enabled: isRpcEnabled, showModButton, data: null };
  }
  if (playbackRequest.isErr()) {
    console.error("Error getting player progress:", playbackRequest.error);
    return { enabled: isRpcEnabled, showModButton, data: null };
  }
  if (isPlayingRequest.isErr()) {
    console.error("Error getting isPlaying:", isPlayingRequest.error);
    return { enabled: isRpcEnabled, showModButton, data: null };
  }

  return {
    enabled: isRpcEnabled,
    showModButton,
    data: {
      trackMeta: trackMetaRequest.value,
      playback: playbackRequest.value,
      isPlaying: isPlayingRequest.value,
    },
  };
};

window.yandexMusicMod.onStorageChanged((key: string, value: any) => {
  if (key === "discordRPC/enabled" && value !== isRpcEnabled) isRpcEnabled = value;
  if (key === "discordRPC/showModButton" && value !== showModButton) showModButton = value;
});

(async () => {
  isRpcEnabled = (await window.yandexMusicMod.getStorageValue("discordRPC/enabled")) === false ? false : true;
  showModButton = (await window.yandexMusicMod.getStorageValue("discordRPC/showModButton")) === false ? false : true;
})();
