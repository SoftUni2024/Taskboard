// Only allow fixed, attribute-free formatting tags, including on reads from DB.
export function sanitizeRichText(value) {
  return String(value ?? "")
    .split(/(<[^>]*>)/g)
    .map((part) => {
      if (
        /^<\/?(?:p|div|br|b|strong|i|em|u|ul|ol|li|h2|h3|blockquote)\s*\/?\s*>$/i.test(
          part,
        )
      )
        return part.toLowerCase();
      return part
        .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    })
    .join("");
}
