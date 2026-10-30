export type DriveFile = { id: string; name: string };

export async function listGoogleSpreadsheets(
  accessToken: string,
): Promise<DriveFile[]> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set(
    "q",
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
  );
  url.searchParams.set("pageSize", "50");
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("orderBy", "modifiedTime desc");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`drive_list_failed:${res.status}:${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}
