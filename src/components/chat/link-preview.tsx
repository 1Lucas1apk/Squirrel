import React, { useState, useEffect, memo } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Linking,
  Platform,
  Animated
} from "react-native";
import { Globe, ExternalLink } from "lucide-react-native";
import * as Haptics from "expo-haptics";

export interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  domain?: string;
}

// Cache em memória limitado a 50 itens para evitar vazamento de memória
const previewCache = new Map<string, LinkMetadata | null>();

function setPreviewCache(url: string, meta: LinkMetadata | null) {
  if (previewCache.size >= 50) {
    const oldestKey = previewCache.keys().next().value;
    if (oldestKey) previewCache.delete(oldestKey);
  }
  previewCache.set(url, meta);
}

// Regex padrão robusto para capturar links http/https
const URL_REGEX = /(https?:\/\/[^\s]+)/i;

/**
 * Extrai o domínio limpo da URL (ex: 'youtube.com', 'google.com')
 */
function extractDomain(url: string): string {
  try {
    const clean = url.replace(/^https?:\/\//i, "").split("/")[0].split("?")[0];
    return clean.replace(/^www\./i, "");
  } catch {
    return "link";
  }
}

/**
 * Busca os metadados OpenGraph da URL
 */
async function fetchLinkMetadata(url: string): Promise<LinkMetadata | null> {
  if (previewCache.has(url)) {
    return previewCache.get(url) || null;
  }

  try {
    const domain = extractDomain(url);

    // Tentativa 1: Microlink API (JSON leve, rápido e gratuito com OpenGraph pré-formatado)
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 4000);

    const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`, {
      signal: ctrl.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json.status === "success" && json.data) {
        const data = json.data;
        const meta: LinkMetadata = {
          url,
          title: data.title || domain,
          description: data.description || undefined,
          image: data.image?.url || data.logo?.url || undefined,
          siteName: data.publisher || domain,
          domain
        };
        setPreviewCache(url, meta);
        return meta;
      }
    }
  } catch {
    // Fallback silencioso
  }

  // Fallback se não conseguir OpenGraph completo
  const fallbackMeta: LinkMetadata = {
    url,
    title: extractDomain(url),
    domain: extractDomain(url)
  };
  setPreviewCache(url, fallbackMeta);
  return fallbackMeta;
}

interface LinkPreviewProps {
  textMessage?: string;
}

export const LinkPreview = memo(function LinkPreview({ textMessage }: LinkPreviewProps) {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(0.3)).current;

  // Extrai a primeira URL encontrada no texto
  const foundUrl = React.useMemo(() => {
    if (!textMessage) return null;
    const match = textMessage.match(URL_REGEX);
    return match ? match[0] : null;
  }, [textMessage]);

  // Animação de Skeleton Shimmer / Pulse
  useEffect(() => {
    if (loading) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 700,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 700,
            useNativeDriver: true
          })
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [loading, pulseAnim]);

  useEffect(() => {
    if (!foundUrl) {
      setMetadata(null);
      setLoading(false);
      return;
    }

    if (previewCache.has(foundUrl)) {
      setMetadata(previewCache.get(foundUrl) || null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetchLinkMetadata(foundUrl).then(data => {
      if (isMounted) {
        setMetadata(data);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [foundUrl]);

  if (!foundUrl) return null;

  const handleOpenUrl = async () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const canOpen = await Linking.canOpenURL(foundUrl);
      if (canOpen) {
        await Linking.openURL(foundUrl);
      } else {
        await Linking.openURL(`https://${foundUrl.replace(/^https?:\/\//i, "")}`);
      }
    } catch (err) {
      console.log("[LinkPreview] Erro ao abrir URL:", err);
    }
  };

  // 1. Estado de Carregamento (Skeleton Shimmer AMOLED)
  if (loading) {
    return (
      <View className="mt-2 rounded-xl overflow-hidden border border-zinc-800 bg-[#161622] p-2.5 max-w-[280px]">
        <Animated.View style={{ opacity: pulseAnim }}>
          <View className="h-28 w-full rounded-lg bg-zinc-800/60 mb-2" />
          <View className="h-3.5 w-3/4 rounded bg-zinc-800/80 mb-1.5" />
          <View className="h-2.5 w-1/2 rounded bg-zinc-800/50" />
        </Animated.View>
      </View>
    );
  }

  if (!metadata || (!metadata.title && !metadata.image)) return null;

  return (
    <Pressable
      onPress={handleOpenUrl}
      className="mt-2 rounded-2xl overflow-hidden border border-zinc-700/60 bg-[#14141e] active:opacity-90 max-w-[280px] shadow-lg"
    >
      {/* Imagem de Capa do Link (OpenGraph / Thumbnail) */}
      {metadata.image ? (
        <View className="w-full h-32 bg-zinc-900 relative">
          <Image
            source={{ uri: metadata.image }}
            className="w-full h-full"
            resizeMode="cover"
          />
          <View className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 border border-white/10">
            <ExternalLink size={12} color="#ffffff" />
          </View>
        </View>
      ) : null}

      {/* Conteúdo Textual (Título, Descrição e Domínio) */}
      <View className="p-3">
        {metadata.siteName || metadata.domain ? (
          <View className="flex-row items-center gap-1 mb-1">
            <Globe size={11} color="#818cf8" />
            <Text className="text-[10.5px] font-mono text-indigo-400 font-bold uppercase tracking-wider truncate" numberOfLines={1}>
              {metadata.siteName || metadata.domain}
            </Text>
          </View>
        ) : null}

        {metadata.title ? (
          <Text className="text-[13px] font-bold text-zinc-100 leading-snug mb-1" numberOfLines={2}>
            {metadata.title}
          </Text>
        ) : null}

        {metadata.description ? (
          <Text className="text-[11px] text-zinc-400 leading-normal" numberOfLines={2}>
            {metadata.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});
