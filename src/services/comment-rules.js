export function commentBody(value) {
  const body = String(value || "").trim();
  if (!body) throw new Error("Write a comment first.");
  if (body.length > 4000)
    throw new Error("Comments can contain up to 4000 characters.");
  return body;
}
