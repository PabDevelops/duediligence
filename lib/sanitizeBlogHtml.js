import sanitizeHtml from 'sanitize-html';

// Blog posts are only ever authored through the admin editor (app/admin/blog — gated by
// checkIsAdmin()), so this isn't guarding against a hostile author today. It's defense-in-depth
// against the two realistic ways that trust boundary breaks: an admin account gets compromised
// (credential leak, session theft), or ADMIN_EMAILS grows to include someone whose judgment you
// don't want to bet the whole site's visitors on. Either way, content_html (produced by the
// Tiptap editor in app/admin/blog/RichEditor.js) gets rendered with dangerouslySetInnerHTML to
// every visitor on both /aprende/[slug] and the legacy /blog/[slug] — sanitizing once here, at
// the point content is saved, means every current and future reader of that column is safe
// without having to remember to sanitize on each render path.
//
// Allowlist matches exactly what RichEditor's Tiptap config can produce (StarterKit's
// paragraphs/headings(2-3)/bold/italic/strike/lists/blockquote/codeBlock/hr, plus the Image,
// Link and Underline extensions) — nothing else is a legitimate output of that editor.
const ALLOWED_TAGS = [
  'p', 'h2', 'h3', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'br', 'a', 'img',
];

const ALLOWED_ATTRIBUTES = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'style'],
};

export function sanitizeBlogHtml(html) {
  if (!html) return html;
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // http(s)/mailto only — strips javascript:/data: URLs in href/src outright.
    allowedSchemes: ['http', 'https', 'mailto'],
    // RichEditor's Link extension never sets target itself, but sanitize-html's own
    // transformTags keeps rel/noopener honest if an admin pastes an <a target="_blank"> in.
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
    },
  });
}
