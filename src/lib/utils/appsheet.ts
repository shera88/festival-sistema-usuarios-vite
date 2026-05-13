export function appsheetAudio(file: string | null | undefined): string | null {
  if (!file) return null;
  if (/^https?:\/\//i.test(file)) return file;
  return `https://www.appsheet.com/template/gettablefileurl?appName=Administraci%C3%B3nDeAudios-308867943&tableName=Registro%20De%20Incripci%C3%B3n%202025&fileName=${encodeURIComponent(file)}`;
}

export function appsheetJuradoFoto(file: string | null | undefined): string | null {
  if (!file) return null;
  if (/^https?:\/\//i.test(file)) return file;
  return `https://www.appsheet.com/image/getimageurl?appName=JURADO2025-308867943&tableName=JURADO&fileName=${encodeURIComponent(file)}`;
}
