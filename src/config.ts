/** Site-wide switches that a project lead may want to flip without touching markup. */

/**
 * How the two lead-capture forms render.
 *
 * - `growthmap`  — our own static forms, POSTing to `PUBLIC_CONTACT_ENDPOINT`
 *                  (playbook §4b). This is the migration target.
 * - `embed`      — the original LeadConnector / GoHighLevel iframes, byte-identical
 *                  to the WordPress site. They are served from `verified.trustymail.co`,
 *                  a GoHighLevel host that outlives the WordPress install, so they are
 *                  a safe fallback until the Growthmap endpoint exists.
 *
 * With no endpoint configured the embeds are kept regardless, so a deploy that
 * happens before the endpoint is created never ships a form that goes nowhere.
 */
export const FORM_MODE: 'growthmap' | 'embed' =
  (import.meta.env.PUBLIC_FORM_MODE as 'growthmap' | 'embed') || 'growthmap';

/** Growthmap lead endpoint (public by design — it is read in the browser). */
export const CONTACT_ENDPOINT = import.meta.env.PUBLIC_CONTACT_ENDPOINT || '';

/**
 * Whether the page links Elementor's Google-font stylesheets.
 *
 * `off` is the default because it is what the WordPress site actually renders:
 * Elementor writes those `src: url(...)` values with an `http://` scheme, the page
 * is served over `https://`, and Chrome blocks every one of them as mixed content —
 * so Inter, Roboto, Montserrat, Poppins and Fira Sans never arrive and the whole
 * site falls back to the system stack. Cloning that faithfully is the brief; see the
 * README's "Original-site bugs".
 *
 * `on` links the same faces, self-hosted over https, and the site renders in the
 * fonts its designer chose. One env var, no markup change.
 */
export const WEBFONTS: 'off' | 'on' =
  (import.meta.env.PUBLIC_WEBFONTS as 'off' | 'on') || 'off';

/** The GoHighLevel chat bubble the WordPress head loads on every page. */
export const CHAT_WIDGET = (import.meta.env.PUBLIC_CHAT_WIDGET || 'on') !== 'off';

export const SITE_NAME = 'Life Agent Growth Systems';
