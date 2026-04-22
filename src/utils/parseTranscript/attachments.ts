import type {
  AttachmentItem,
  AttachmentKind,
  AttachmentSummary,
  MessageAttachment,
} from "../../types/transcript";

const CARD_CT_PREFIX = "application/vnd.microsoft.card.";
const SKYPE_AMS_HOST_SUFFIX = ".asm.skype.com";

/**
 * Returns true iff `url` is an absolute URL whose hostname is `asm.skype.com`
 * itself or any subdomain of it (e.g. `us-api.asm.skype.com`).
 *
 * Uses URL parsing rather than substring matching so we are not fooled by
 * attacker-controlled URLs like `https://evil.com/?x=us-api.asm.skype.com`
 * or `https://us-api.asm.skype.com.evil.com/...`.
 */
function isSkypeAmsUrl(url: string | undefined): boolean {
  if (!url) return false;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === SKYPE_AMS_HOST_SUFFIX.slice(1) || host.endsWith(SKYPE_AMS_HOST_SUFFIX);
}

function cardKindLabel(contentType: string): string {
  // e.g. "application/vnd.microsoft.card.adaptive" -> "Adaptive Card"
  const suffix = contentType.slice(CARD_CT_PREFIX.length);
  if (!suffix) return "Card";
  return suffix.charAt(0).toUpperCase() + suffix.slice(1) + " Card";
}

function shortTypeLabel(contentType: string): string {
  if (contentType === "image/*") return "image";
  if (contentType.startsWith("image/")) return contentType;
  if (contentType === "application/pdf") return "PDF";
  if (contentType.startsWith("application/")) return contentType.slice("application/".length);
  return contentType;
}

interface HtmlImgInfo {
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
}

function firstImgFromHtml(html: string): HtmlImgInfo | undefined {
  // Grab the first <img ...> tag; attributes can appear in any order
  const tagMatch = html.match(/<img\b[^>]*>/i);
  if (!tagMatch) return undefined;
  const tag = tagMatch[0];
  const attr = (name: string) => {
    const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
    return m ? m[1] : undefined;
  };
  const w = attr("width");
  const h = attr("height");
  return {
    src: attr("src"),
    alt: attr("alt"),
    width: w ? parseInt(w, 10) || undefined : undefined,
    height: h ? parseInt(h, 10) || undefined : undefined,
  };
}

/**
 * Classify attachments on a raw activity into a summary suitable for UI chips.
 * See AttachmentKind JSDoc for heuristic details.
 */
export function classifyAttachments(
  rawAttachments: MessageAttachment[],
): AttachmentSummary | undefined {
  if (!rawAttachments.length) return undefined;

  // Split cards from media/file references. Cards are bot-sent UI and are
  // handled elsewhere (AdaptiveCardRenderer) — don't count them as user content.
  const nonCards: MessageAttachment[] = [];
  const cards: MessageAttachment[] = [];
  let htmlBlob = "";
  for (const a of rawAttachments) {
    if (a.contentType?.startsWith(CARD_CT_PREFIX)) {
      cards.push(a);
    } else if (a.contentType === "text/html" && typeof a.content === "string") {
      htmlBlob += a.content;
    } else if (a.contentType === "text/html" && typeof (a.content as { toString?: () => string }) === "object") {
      // Some clients nest the html as object — best-effort
      htmlBlob += JSON.stringify(a.content);
    } else {
      nonCards.push(a);
    }
  }

  const img = htmlBlob ? firstImgFromHtml(htmlBlob) : undefined;
  const hasSkypeInline = isSkypeAmsUrl(img?.src);

  const items: AttachmentItem[] = [];

  for (const a of nonCards) {
    const ct = a.contentType;
    const ref = typeof (a.content as { value?: unknown })?.value === "string"
      ? ((a.content as { value: string }).value)
      : undefined;

    let kind: AttachmentKind;
    if (ct === "image/*" || hasSkypeInline) {
      // Wildcard mime OR we have an inline Skype-hosted <img> → paste
      kind = "paste";
    } else if (ct.startsWith("image/")) {
      // Specific image mime with no inline HTML sibling → uploaded from device
      kind = "upload";
    } else if (ct.startsWith("application/") || ct.startsWith("text/") || ct.startsWith("video/") || ct.startsWith("audio/")) {
      kind = "file";
    } else {
      kind = "unknown";
    }

    items.push({
      kind,
      contentType: ct,
      label: ct.startsWith("image/") ? "image" : shortTypeLabel(ct),
      altText: img?.alt && img.alt !== "image" ? img.alt : undefined,
      width: img?.width,
      height: img?.height,
      referenceId: ref,
    });
  }

  for (const c of cards) {
    items.push({
      kind: "card",
      contentType: c.contentType,
      label: cardKindLabel(c.contentType),
    });
  }

  if (!items.length) return undefined;

  // Aggregate kind: if all items agree, use that; otherwise "unknown"
  const first = items[0].kind;
  const aggregate: AttachmentKind = items.every((i) => i.kind === first) ? first : "unknown";

  return { kind: aggregate, items };
}
