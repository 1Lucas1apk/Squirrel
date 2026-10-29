import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";

// Credenciais OAuth2 para Upload Direto ao Google Drive (Configuradas via .env)
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REFRESH_TOKEN = process.env.EXPO_PUBLIC_GOOGLE_REFRESH_TOKEN || "";
const ROOT_FOLDER_ID = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID || "1UZkP2w9Gqu7YuNgNcUF4w17lZUwr_jRf"; // Pasta "Squirrel"

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;
const memoryFolderCache = new Map<string, string>();

// 1. Obter Access Token Válido via Refresh Token
export async function getValidDriveAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    console.warn("[GoogleDriveDirect] Credenciais do Google Drive não configuradas em EXPO_PUBLIC_GOOGLE_*");
    throw new Error("Credenciais do Google Drive não configuradas no ambiente");
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!res.ok) {
      throw new Error(`Falha ao renovar token OAuth: ${res.status}`);
    }

    const data = await res.json();
    cachedAccessToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
    return cachedAccessToken!;
  } catch (err: any) {
    console.error("[GoogleDriveDirect] Erro ao obter access token:", err.message);
    throw err;
  }
}

// 2. Criar ou Buscar Pasta no Google Drive com Cache em Memória e AsyncStorage
async function getOrCreateFolderCached(
  accessToken: string,
  folderName: string,
  parentFolderId: string
): Promise<string> {
  const cacheKey = `@drive_folder_${parentFolderId}_${folderName}`;
  
  // Verifica cache em memória
  if (memoryFolderCache.has(cacheKey)) {
    return memoryFolderCache.get(cacheKey)!;
  }

  // Verifica cache local persistente no AsyncStorage
  try {
    const savedId = await AsyncStorage.getItem(cacheKey);
    if (savedId) {
      memoryFolderCache.set(cacheKey, savedId);
      return savedId;
    }
  } catch {}

  try {
    const query = encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentFolderId}' in parents and trashed=false`
    );

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const foundId = searchData.files[0].id;
        memoryFolderCache.set(cacheKey, foundId);
        await AsyncStorage.setItem(cacheKey, foundId).catch(() => {});
        return foundId;
      }
    }

    // Criar pasta se não existir
    const createRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
        }),
      }
    );

    if (createRes.ok) {
      const createData = await createRes.json();
      const createdId = createData.id;
      memoryFolderCache.set(cacheKey, createdId);
      await AsyncStorage.setItem(cacheKey, createdId).catch(() => {});
      return createdId;
    }
  } catch (err: any) {
    console.warn("[GoogleDriveDirect] Aviso ao criar pasta:", err.message);
  }

  return parentFolderId;
}

// Obter ID da Pasta do Dia com 0 requisições após o primeiro cache
async function getDailyFolderId(accessToken: string): Promise<string> {
  const now = new Date();
  const ano = String(now.getFullYear());
  const meses = ["01_Jan", "02_Fev", "03_Mar", "04_Abr", "05_Mai", "06_Jun", "07_Jul", "08_Ago", "09_Set", "10_Out", "11_Nov", "12_Dez"];
  const mes = meses[now.getMonth()];
  const dia = `Dia_${String(now.getDate()).padStart(2, "0")}`;
  const fullDayKey = `@drive_daily_folder_${ano}_${mes}_${dia}`;

  if (memoryFolderCache.has(fullDayKey)) {
    return memoryFolderCache.get(fullDayKey)!;
  }

  try {
    const saved = await AsyncStorage.getItem(fullDayKey);
    if (saved) {
      memoryFolderCache.set(fullDayKey, saved);
      return saved;
    }
  } catch {}

  const anoId = await getOrCreateFolderCached(accessToken, ano, ROOT_FOLDER_ID);
  const mesId = await getOrCreateFolderCached(accessToken, mes, anoId);
  const diaId = await getOrCreateFolderCached(accessToken, dia, mesId);

  memoryFolderCache.set(fullDayKey, diaId);
  await AsyncStorage.setItem(fullDayKey, diaId).catch(() => {});
  return diaId;
}

// 3. Gerador de Identificador Único Universal (UUID + Timestamp + Operador)
export function gerarIdentificadorArquivo(operador: string, tipo: string = "chat"): string {
  const now = new Date();
  const dataIso = now.toISOString().slice(0, 10);
  const hora = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const seg = String(now.getSeconds()).padStart(2, "0");
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const cleanOp = (operador || "anon").replace(/[^a-zA-Z0-9_]/g, "");

  return `SQ_${dataIso}_${hora}h${min}m${seg}s_${cleanOp}_${tipo}_${randomPart}.jpg`;
}

// 4. Upload Direto Resiliente para o Google Drive 5TB (com Cache de Pastas e Backoff Anti-429)
export async function uploadDiretoGoogleDrive(
  imageUriOrBase64: string,
  operador: string = "usuario",
  tipo: string = "chat",
  tentativas: number = 3
): Promise<{ success: boolean; url: string; driveFileId?: string }> {
  let attempt = 0;

  while (attempt < tentativas) {
    attempt++;
    try {
      const accessToken = await getValidDriveAccessToken();

      // 1. Obter pasta diária direto do Cache (0 requisições após o primeiro envio do dia)
      const diaId = await getDailyFolderId(accessToken);
      const uniqueFileName = gerarIdentificadorArquivo(operador, tipo);

      // 2. Obter binário da imagem
      let base64Data = "";
      if (imageUriOrBase64.startsWith("data:image/")) {
        base64Data = imageUriOrBase64.split(",")[1];
      } else if (Platform.OS === "web") {
        const fetchRes = await fetch(imageUriOrBase64);
        const blob = await fetchRes.blob();
        const reader = new FileReader();
        base64Data = await new Promise((resolve) => {
          reader.onloadend = () => {
            const res = reader.result as string;
            resolve(res.split(",")[1]);
          };
          reader.readAsDataURL(blob);
        });
      } else {
        const localFile = new File(imageUriOrBase64);
        base64Data = await localFile.base64();
      }

      // 3. Upload Multipart direto para a API do Google Drive
      const metadata = {
        name: uniqueFileName,
        parents: [diaId],
        mimeType: "image/jpeg",
        description: `Enviado via Squirrel App | Operador: ${operador} | Tipo: ${tipo}`,
      };

      const boundary = "-------314159265358979323846";
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartRequestBody =
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        "Content-Type: image/jpeg\r\n" +
        "Content-Transfer-Encoding: base64\r\n\r\n" +
        base64Data +
        closeDelimiter;

      const uploadRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      if (uploadRes.ok) {
        const fileData = await uploadRes.json();
        const fileId = fileData.id;

        // Torna o arquivo público (Anyone with link can view) para liberar acesso direto
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              role: "reader",
              type: "anyone",
            }),
          });
        } catch (permErr: any) {
          console.warn("[GoogleDriveDirect] Erro ao aplicar permissão pública:", permErr?.message);
        }

        const directUrl = `https://lh3.googleusercontent.com/u/0/d/${fileId}`;
        void cacheDriveImage(fileId, base64Data);
        console.log(`✅ [GoogleDriveDirect] Foto enviada direto e em cache! ID: ${fileId} | Arquivo: ${uniqueFileName}`);

        return {
          success: true,
          url: directUrl,
          driveFileId: fileId,
        };
      } else {
        const errBody = await uploadRes.text();
        console.warn(`[GoogleDriveDirect] Tentativa ${attempt} falhou (${uploadRes.status}):`, errBody);

        // Se for rate limit (429 ou 403), faz espera com backoff exponencial
        if (uploadRes.status === 429 || uploadRes.status === 403) {
          const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.log(`[GoogleDriveDirect] Rate Limit detectado. Aguardando ${Math.round(delayMs)}ms antes de retentar...`);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
      }
    } catch (err: any) {
      console.warn(`[GoogleDriveDirect] Erro na tentativa ${attempt}:`, err.message);
    }

    // Espera padrão com backoff antes de tentar novamente
    if (attempt < tentativas) {
      const retryDelay = Math.pow(2, attempt) * 800 + Math.random() * 300;
      await new Promise((r) => setTimeout(r, retryDelay));
    }
  }

  // Fallback seguro se não conseguir após todas as tentativas: usa base64 local
  console.log("[GoogleDriveDirect] Usando fallback local para não perder o envio.");
  return {
    success: true,
    url: imageUriOrBase64.startsWith("data:image/") ? imageUriOrBase64 : `data:image/jpeg;base64,${imageUriOrBase64}`,
  };
}

const memoryImageCache = new Map<string, string>();

function setMemoryImageCache(fileId: string, data: string) {
  if (memoryImageCache.size >= 25) {
    const oldest = memoryImageCache.keys().next().value;
    if (oldest) memoryImageCache.delete(oldest);
  }
  memoryImageCache.set(fileId, data);
}

/**
 * Salva imagem em cache local (memória + AsyncStorage) para carregamento instantâneo
 */
export async function cacheDriveImage(fileIdOrUrl: string, base64OrDataUri: string): Promise<void> {
  const fileId = extractGoogleDriveFileId(fileIdOrUrl);
  if (!fileId || !base64OrDataUri) return;
  // Apenas faz cache de itens leves (<= 250KB) para não consumir a memória RAM do app
  if (base64OrDataUri.length < 250000) {
    const fullDataUri = base64OrDataUri.startsWith("data:")
      ? base64OrDataUri
      : `data:image/jpeg;base64,${base64OrDataUri}`;
    setMemoryImageCache(fileId, fullDataUri);
    try {
      await AsyncStorage.setItem(`@drive_img_${fileId}`, fullDataUri);
    } catch {}
  }
}

/**
 * Obtém imagem do cache local se disponível
 */
export async function getCachedDriveImage(fileIdOrUrl: string): Promise<string | null> {
  const fileId = extractGoogleDriveFileId(fileIdOrUrl);
  if (!fileId) return null;
  if (memoryImageCache.has(fileId)) {
    return memoryImageCache.get(fileId)!;
  }
  try {
    const cached = await AsyncStorage.getItem(`@drive_img_${fileId}`);
    if (cached) {
      setMemoryImageCache(fileId, cached);
      return cached;
    }
  } catch {}
  return null;
}

export function extractGoogleDriveFileId(urlOrId?: string): string | null {
  if (!urlOrId) return null;
  const lh3Match = urlOrId.match(/lh3\.googleusercontent\.com\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1]) return lh3Match[1];

  const fileIdMatch =
    urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    urlOrId.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    urlOrId.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) return fileIdMatch[1];

  if (/^[a-zA-Z0-9_-]{25,}$/.test(urlOrId)) return urlOrId;
  return null;
}

/**
 * Converte URLs do Google Drive para o formato direto estável lh3 com redimensionamento dinâmico
 * do CDN do Google (Google User Content CDN), entregando imagens compactadas sob medida (ex: 96px para avatar, 480px para balão)
 */
export function formatGoogleDriveThumbnailUrl(urlOrId?: string, size?: number): string {
  if (!urlOrId) return "";
  if (urlOrId.startsWith("data:") || urlOrId.startsWith("file://") || urlOrId.startsWith("blob:")) {
    return urlOrId;
  }

  const fileId = extractGoogleDriveFileId(urlOrId);
  if (fileId) {
    // Redimensionamento inteligente no servidor do Google:
    // Se for avatar ou thumbnail pequeno (size informado), entrega na resolução exata (~4KB a ~15KB)
    // Se for preview padrão em balão de chat (sem size), usa 480px (~30KB em vez de 8MB!)
    // O Android/Fresco decodifica em menos de 1ms sem estourar a memória RAM da GPU
    const targetSize = size ? Math.min(Math.max(size, 48), 1600) : 480;
    return `https://lh3.googleusercontent.com/u/0/d/${fileId}=s${targetSize}`;
  }

  return urlOrId;
}

export const formatGoogleDriveUrl = formatGoogleDriveThumbnailUrl;

export async function makeFilePublic(urlOrId: string): Promise<boolean> {
  const fileId = extractGoogleDriveFileId(urlOrId);
  if (!fileId) return false;

  try {
    const accessToken = await getValidDriveAccessToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone",
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn("[GoogleDriveDirect] Falha ao tornar arquivo público:", err);
    return false;
  }
}
