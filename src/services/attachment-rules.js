export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const FILE_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
};
export function validateFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (!FILE_TYPES[extension])
    throw new Error("Choose an image, PDF, text, or Office document.");
  if (file.size > MAX_FILE_SIZE)
    throw new Error(`${file.name} exceeds the 10 MB limit.`);
  if (!file.size) throw new Error("Empty files cannot be attached.");
  return FILE_TYPES[extension];
}
export function safeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140) || "attachment";
}
export function attachmentName(name) {
  return name.slice(38);
}
