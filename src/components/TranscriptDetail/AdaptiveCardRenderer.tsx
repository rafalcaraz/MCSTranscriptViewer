/**
 * Lightweight Adaptive Card renderer for transcript viewer.
 * Handles the common card patterns found in Copilot Studio transcripts:
 * - TextBlock (with size/weight)
 * - ColumnSet / Column with Image
 * - ActionSet / Action.Submit / Action.OpenUrl
 * - Connection consent cards
 * - OAuth cards
 */

interface AdaptiveCardProps {
  content: Record<string, unknown>;
  contentType: string;
}

export function AdaptiveCardRenderer({ content, contentType }: AdaptiveCardProps) {
  // OAuth card — just plumbing, show consent indicator
  if (contentType === "application/vnd.microsoft.card.oauth") {
    return (
      <div className="ac-card ac-oauth">
        <div className="ac-oauth-icon">🔐</div>
        <div className="ac-oauth-text">
          <strong>Authentication Required</strong>
          <div>Connection consent was requested</div>
        </div>
      </div>
    );
  }

  // Adaptive Card
  if (contentType === "application/vnd.microsoft.card.adaptive") {
    return (
      <div className="ac-card">
        {Array.isArray(content.body) && renderElements(content.body as CardElement[])}
        {Array.isArray(content.actions) && (
          <div className="ac-actions">
            {(content.actions as CardAction[]).map((action, i) => (
              <RenderAction key={i} action={action} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback
  return <div className="ac-card"><em>📋 Unsupported card type</em></div>;
}

// ── Types ────────────────────────────────────────

interface CardElement {
  type: string;
  text?: string;
  size?: string;
  weight?: string;
  wrap?: boolean;
  url?: string;
  altText?: string;
  columns?: CardColumn[];
  items?: CardElement[];
  actions?: CardAction[];
  [key: string]: unknown;
}

interface CardColumn {
  type: string;
  width?: string;
  items?: CardElement[];
}

interface CardAction {
  type: string;
  title?: string;
  url?: string;
  [key: string]: unknown;
}

// ── Renderers ────────────────────────────────────

function renderElements(elements: CardElement[]): React.ReactNode[] {
  return elements.map((el, i) => <RenderElement key={i} element={el} />);
}

function RenderElement({ element: el }: { element: CardElement }) {
  switch (el.type) {
    case "TextBlock":
      return <RenderTextBlock element={el} />;
    case "Image":
      return <RenderImage element={el} />;
    case "ColumnSet":
      return <RenderColumnSet element={el} />;
    case "ActionSet":
      return (
        <div className="ac-actions">
          {(el.actions ?? []).map((a, i) => <RenderAction key={i} action={a} />)}
        </div>
      );
    case "Container":
      return <div className="ac-container">{el.items && renderElements(el.items)}</div>;
    case "RichTextBlock":
      return <div className="ac-text">{String(el.text ?? "")}</div>;
    default:
      return null;
  }
}

function RenderTextBlock({ element: el }: { element: CardElement }) {
  const sizeClass = el.size === "medium" || el.size === "large" ? "ac-text-medium" : "";
  const weightClass = el.weight === "bolder" ? "ac-text-bold" : "";
  return (
    <div className={`ac-text ${sizeClass} ${weightClass}`}>
      {el.text ?? ""}
    </div>
  );
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function RenderImage({ element: el }: { element: CardElement }) {
  if (!el.url || !isSafeUrl(el.url)) return null;
  return (
    <img
      className="ac-image"
      src={el.url}
      alt={el.altText ?? ""}
      style={{ maxHeight: 32, maxWidth: 32 }}
    />
  );
}

function RenderColumnSet({ element: el }: { element: CardElement }) {
  return (
    <div className="ac-columnset">
      {(el.columns ?? []).map((col, i) => (
        <div key={i} className="ac-column" style={{ flex: col.width === "auto" ? "0 0 auto" : "1 1 0" }}>
          {col.items && renderElements(col.items)}
        </div>
      ))}
    </div>
  );
}

function RenderAction({ action }: { action: CardAction }) {
  const label = action.title ?? action.type;
  if (action.type === "Action.OpenUrl" && action.url && isSafeUrl(action.url)) {
    return (
      <a className="ac-action-btn" href={action.url} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  }
  return <span className="ac-action-btn">{label}</span>;
}
