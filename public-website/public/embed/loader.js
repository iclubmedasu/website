/**
 * iClub registration embed loader (shared for all events).
 *
 * Host-site usage:
 *
 *   <div
 *     id="iclub-register"
 *     data-event="my-event-slug"
 *     data-primary-color="#0b5fff"
 *     data-accent-color="#00a3a1"
 *     data-border-radius="8px"
 *     data-font-family="Inter, system-ui, sans-serif"
 *     data-layout="compact"
 *     data-custom-css-url="https://example.com/event-theme.css"
 *   ></div>
 *   <script src="https://YOUR-PUBLIC-SITE/embed/loader.js" async></script>
 *
 * Or mount explicitly:
 *
 *   <script src="https://YOUR-PUBLIC-SITE/embed/loader.js"></script>
 *   <script>
 *     IClubRegistrationEmbed.mount("#iclub-register", { event: "my-event-slug" });
 *   </script>
 */
(function (global) {
  "use strict";

  var MESSAGE_TYPE = "iclub-embed-resize";
  var SCRIPT = document.currentScript;
  var SCRIPT_ORIGIN = "";

  try {
    if (SCRIPT && SCRIPT.src) {
      SCRIPT_ORIGIN = new URL(SCRIPT.src).origin;
    }
  } catch (_) {
    SCRIPT_ORIGIN = "";
  }

  if (!SCRIPT_ORIGIN && global.location) {
    SCRIPT_ORIGIN = global.location.origin;
  }

  function readAttr(el, name) {
    if (!el || !el.getAttribute) return null;
    var value = el.getAttribute(name);
    if (value == null) return null;
    value = String(value).trim();
    return value ? value : null;
  }

  function buildSrc(options) {
    var eventId = options.event;
    if (!eventId) {
      throw new Error("iClub embed: missing data-event / options.event");
    }

    var base = (options.origin || SCRIPT_ORIGIN || "").replace(/\/$/, "");
    var url = new URL(base + "/embed/events/" + encodeURIComponent(eventId) + "/register");

    if (options.primaryColor) url.searchParams.set("primaryColor", options.primaryColor);
    if (options.accentColor) url.searchParams.set("accentColor", options.accentColor);
    if (options.borderRadius) url.searchParams.set("borderRadius", options.borderRadius);
    if (options.fontFamily) url.searchParams.set("fontFamily", options.fontFamily);
    if (options.layout) url.searchParams.set("layout", options.layout);
    if (options.customCssUrl) url.searchParams.set("customCssUrl", options.customCssUrl);

    return url.toString();
  }

  function optionsFromElement(el) {
    return {
      event: readAttr(el, "data-event") || readAttr(el, "data-event-id") || readAttr(el, "data-event-slug"),
      primaryColor: readAttr(el, "data-primary-color"),
      accentColor: readAttr(el, "data-accent-color"),
      borderRadius: readAttr(el, "data-border-radius"),
      fontFamily: readAttr(el, "data-font-family"),
      layout: readAttr(el, "data-layout"),
      customCssUrl: readAttr(el, "data-custom-css-url"),
      origin: readAttr(el, "data-origin") || SCRIPT_ORIGIN,
      minHeight: readAttr(el, "data-min-height") || "320",
    };
  }

  function mount(target, overrideOptions) {
    var el =
      typeof target === "string" ? document.querySelector(target) : target;
    if (!el) {
      throw new Error("iClub embed: container not found");
    }

    var options = Object.assign({}, optionsFromElement(el), overrideOptions || {});
    var src = buildSrc(options);
    var minHeight = parseInt(options.minHeight || "320", 10);
    if (isNaN(minHeight) || minHeight < 120) minHeight = 320;

    // Clear previous mount.
    el.innerHTML = "";

    var iframe = document.createElement("iframe");
    iframe.setAttribute("src", src);
    iframe.setAttribute("title", "Event registration");
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-same-origin allow-popups"
    );
    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.minHeight = minHeight + "px";
    iframe.style.height = minHeight + "px";
    iframe.style.overflow = "hidden";
    iframe.style.background = "transparent";

    el.appendChild(iframe);
    el.setAttribute("data-iclub-embed-mounted", "true");

    function onMessage(event) {
      if (!event || !event.data || event.data.type !== MESSAGE_TYPE) return;
      if (event.data.source !== "iclub-registration-embed") return;
      // Only accept messages from the iframe we created.
      if (event.source !== iframe.contentWindow) return;
      // Prefer same-origin messages when origin is known.
      try {
        var expectedOrigin = new URL(src).origin;
        if (event.origin && event.origin !== expectedOrigin) return;
      } catch (_) {
        // ignore URL parse issues
      }

      var height = Number(event.data.height);
      if (!height || height < 1) return;
      iframe.style.height = Math.ceil(height) + "px";
    }

    global.addEventListener("message", onMessage);

    return {
      iframe: iframe,
      destroy: function () {
        global.removeEventListener("message", onMessage);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        el.removeAttribute("data-iclub-embed-mounted");
      },
    };
  }

  function autoMount() {
    var nodes = document.querySelectorAll(
      "#iclub-register, [data-iclub-register], [data-iclub-embed='registration'], .iclub-register"
    );

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node || node.getAttribute("data-iclub-embed-mounted") === "true") continue;
      // Skip containers that already have non-iframe content.
      if (node.children && node.children.length > 0) continue;
      try {
        mount(node);
      } catch (err) {
        if (global.console && console.error) {
          console.error(err);
        }
      }
    }
  }

  var api = {
    mount: mount,
    buildSrc: buildSrc,
    autoMount: autoMount,
  };

  global.IClubRegistrationEmbed = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }
})(typeof window !== "undefined" ? window : this);
