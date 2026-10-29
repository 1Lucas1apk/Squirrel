import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { uploadDiretoGoogleDrive } from "./google-drive-direct-service";

const SERVER_URL_KEY = "@squirrel_media_server_url";
export const DEFAULT_MEDIA_SERVER_URL = "http://2.56.246.119:30138";

export async function getMediaServerUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(SERVER_URL_KEY);
    return saved?.trim() || DEFAULT_MEDIA_SERVER_URL;
  } catch {
    return DEFAULT_MEDIA_SERVER_URL;
  }
}

export async function setMediaServerUrl(url: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SERVER_URL_KEY, url.trim());
  } catch {}
}

export interface UploadResult {
  success: boolean;
  url?: string;
  driveUrl?: string;
  error?: string;
}

export async function uploadImagemParaServidor(
  localUri: string,
  metadata?: { operador?: string; tipo?: string }
): Promise<UploadResult> {
  const operador = metadata?.operador || "usuario";
  const tipo = metadata?.tipo || "chat";

  // 1. Prioridade Máxima: Upload Direto para o Google Drive 5TB (sem depender de servidor)
  try {
    const driveDirectRes = await uploadDiretoGoogleDrive(localUri, operador, tipo, 3);
    if (driveDirectRes.success && driveDirectRes.url) {
      return {
        success: true,
        url: driveDirectRes.url,
        driveUrl: driveDirectRes.url,
      };
    }
  } catch (err: any) {
    console.log("[MediaUpload] Erro no upload direto ao Drive, tentando servidor Pterodactyl:", err.message);
  }

  // 2. Segunda Opção: Envio via Servidor Pterodactyl
  const serverUrl = await getMediaServerUrl();
  if (serverUrl) {
    try {
      const cleanUrl = serverUrl.replace(/\/$/, "");
      const formData = new FormData();

      const fileName = localUri.split("/").pop() || `foto_${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(fileName);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      if (Platform.OS === "web") {
        const response = await fetch(localUri);
        const blob = await response.blob();
        formData.append("file", blob, fileName);
      } else {
        // @ts-ignore
        formData.append("file", {
          uri: Platform.OS === "android" ? localUri : localUri.replace("file://", ""),
          name: fileName,
          type: type,
        });
      }

      if (metadata?.operador) {
        formData.append("operador", metadata.operador);
      }

      const res = await fetch(`${cleanUrl}/upload`, {
        method: "POST",
        body: formData,
        headers: {
          "Accept": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && (data.url || data.driveUrl)) {
          return {
            success: true,
            url: data.url || data.driveUrl,
            driveUrl: data.driveUrl,
          };
        }
      }
    } catch (e: any) {
      console.log("[MediaUpload] Erro no Pterodactyl:", e.message);
    }
  }

  // 3. Fallback Seguro: Se a internet estiver totalmente offline, retorna a URI local/base64
  return {
    success: true,
    url: localUri,
  };
}
