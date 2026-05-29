const YandexApiOnRequestHandlers = [];
const YandexApiOnResponseHandlers = [];
const originalFetch = window.fetch;

// отключить попытку отправки аналитики. Она и так заблочена, но без этого будет сыпать ошибками в консоль
navigator.sendBeacon = function (...args) {
  return true;
};

// Список доменов/путей для блокировки на уровне renderer
const blockedFetchPatterns = [
  "log.strm.yandex.ru",
  "api.music.yandex.net/dynamic-pages/trigger/polling",
  "mc.yandex.ru",
  "mc.yandex.com",
  "yandex.ru/clck",
  "yandex.ru/an/",
  "yandex.ru/ads/",
  "awaps.yandex.ru",
  "bs.yandex.ru",
  "an.yandex.ru",
  "partner.yandex.ru",
  "banners.yandex.ru",
  "browser-report.yandex.ru",
  "crash-reports.browser.yandex.net",
  "strm.yandex.ru/ping",
];

function isBlockedUrl(url) {
  if (!url) return false;
  return blockedFetchPatterns.some((pattern) => url.includes(pattern));
}

(function () {
  const originalAppendChild = document.head.appendChild;

  document.head.appendChild = function (element) {
    // Проверяем, что это script элемент
    if (element instanceof HTMLScriptElement) {
      const src = element.src || "";

      // Проверяем URL
      if (
        src.includes("https://yandex.ru/ads/system/adsdk.js") ||
        src.includes("https://mc.yandex.ru/metrika/tag.js") ||
        src.includes("https://yastatic.net/pcode/")
      ) {
        console.log("Заблокирована попытка добавить Yandex скрипт:", src);
        return true; // Возвращаем true как указано в требованиях
      }
    }

    // Для всех остальных элементов используем оригинальный метод
    return originalAppendChild.call(this, element);
  };
})();

// Блокировка XMLHttpRequest на аналитические домены
(function () {
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (isBlockedUrl(typeof url === "string" ? url : url?.toString())) {
      console.log("[AntiTelemetry] XMLHttpRequest заблокирован:", url);
      // Открываем запрос на пустой data URI чтобы не ломать вызывающий код
      return originalOpen.call(this, method, "data:text/plain,", ...rest);
    }
    return originalOpen.call(this, method, url, ...rest);
  };
})();

export function initFetchInterceptor() {
  window.fetch = function (...args) {
    var request = [...args][0];
    const url = typeof request === "string" ? request : request?.url;

    // Блокировка аналитических запросов
    if (isBlockedUrl(url)) {
      return Promise.resolve(new Response());
    }

    if (url && url.startsWith("https://api.music.yandex.net"))
      return yandexApiFetch(...args);

    try {
      return originalFetch(...args);
    } catch (e) {}
  };
}

const yandexApiFetch = async function (...args) {
  let [resource, config] = args;

  console.log(`[YandexApiFetch] new request: ${resource.url}`, resource.headers);

  if (YandexApiOnRequestHandlers.find((x) => resource.url.includes(x.url))) {
    for (var i = 0; i < YandexApiOnRequestHandlers.length; i++) {
      if (!resource.url.includes(YandexApiOnRequestHandlers[i].url)) continue;
      var requestOverride = await YandexApiOnRequestHandlers[i].handler(resource);
      if (!requestOverride) continue;
      args.resource = requestOverride;
      resource = requestOverride;
    }
  }

  if (YandexApiOnResponseHandlers.find((x) => resource.url.includes(x.url))) {
    const response = await originalFetch(resource);
    const clonedResponse = response.clone();
    const data = await clonedResponse.json();

    let resp = data;

    for (var i = 0; i < YandexApiOnResponseHandlers.length; i++) {
      if (resource.url.includes(YandexApiOnResponseHandlers[i].url)) {
        resp = await YandexApiOnResponseHandlers[i].handler({
          url: resource.url,
          data: resp,
        });
      }
    }

    if (resp) {
      const modifiedResponse = new Response(JSON.stringify(resp));
      return modifiedResponse;
    }

    return new Response(JSON.stringify(data));
  }

  return originalFetch(resource);
};

export const onYandexApiRequest = function (urlMatch, handler) {
  YandexApiOnRequestHandlers.push({
    url: urlMatch,
    handler: handler,
  });
};

export const onYandexApiResponse = function (urlMatch, handler) {
  YandexApiOnResponseHandlers.push({
    url: urlMatch,
    handler: handler,
  });
};
