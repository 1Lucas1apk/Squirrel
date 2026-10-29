import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  Platform,
  ActivityIndicator,
  PanResponder,
  StatusBar,
  Animated,
  useWindowDimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  RotateCw,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  FlipHorizontal2,
  Maximize2
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export interface PhotoViewerMeta {
  senderName?: string;
  senderUsername?: string;
  timestamp?: number;
  caption?: string;
}

interface AdvancedPhotoViewerProps {
  visible: boolean;
  imageUri?: string | null;
  images?: string[];
  initialIndex?: number;
  meta?: PhotoViewerMeta | null;
  onClose: () => void;
}

export function AdvancedPhotoViewer({
  visible,
  imageUri,
  images,
  initialIndex = 0,
  meta,
  onClose
}: AdvancedPhotoViewerProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Lista normalizada de fotos
  const photoList = React.useMemo(() => {
    if (images && images.length > 0) return images;
    if (imageUri) return [imageUri];
    return [];
  }, [images, imageUri]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [currentScale, setCurrentScale] = useState(1);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [isFlippedX, setIsFlippedX] = useState(false);
  const [showHud, setShowHud] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Animações de Transformação (Zoom, Pan, Slide Horizontal e Transparência)
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const panAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const bgOpacityAnim = useRef(new Animated.Value(1)).current;

  // Refs de Controle de Gestos
  const currentScaleRef = useRef(1);
  currentScaleRef.current = currentScale;

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const photoListRef = useRef(photoList);
  photoListRef.current = photoList;

  const panOffsetRef = useRef({ x: 0, y: 0 });
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1);
  const pinchCenterRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<any>(null);

  const resetTransforms = useCallback(() => {
    setCurrentScale(1);
    setRotationDeg(0);
    setIsFlippedX(false);
    panOffsetRef.current = { x: 0, y: 0 };
    scaleAnim.setValue(1);
    panAnim.setValue({ x: 0, y: 0 });
    slideAnim.setValue(0);
    bgOpacityAnim.setValue(1);
  }, [scaleAnim, panAnim, slideAnim, bgOpacityAnim]);

  useEffect(() => {
    if (visible) {
      const idx = Math.max(0, Math.min(initialIndex, Math.max(0, photoList.length - 1)));
      setCurrentIndex(idx);
      resetTransforms();
      setShowHud(true);
      setToastMessage(null);
    }
  }, [visible, initialIndex, photoList.length, resetTransforms]);

  const currentPhotoUri = photoList[currentIndex] || imageUri || "";

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(style);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const toggleHud = useCallback(() => {
    setShowHud(prev => !prev);
  }, []);

  // Transição Suave de Próxima Foto
  const goToNextImage = useCallback(() => {
    const list = photoListRef.current;
    const cur = currentIndexRef.current;
    if (cur < list.length - 1) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      Animated.timing(slideAnim, {
        toValue: -screenWidth,
        duration: 160,
        useNativeDriver: true
      }).start(() => {
        setCurrentIndex(cur + 1);
        resetTransforms();
      });
    } else {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      // Efeito de mola indicando fim do carrossel
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: -40, duration: 80, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, bounciness: 6, useNativeDriver: true })
      ]).start();
    }
  }, [screenWidth, slideAnim, resetTransforms]);

  // Transição Suave de Foto Anterior
  const goToPrevImage = useCallback(() => {
    const cur = currentIndexRef.current;
    if (cur > 0) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 160,
        useNativeDriver: true
      }).start(() => {
        setCurrentIndex(cur - 1);
        resetTransforms();
      });
    } else {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      // Efeito de mola indicando início do carrossel
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: 40, duration: 80, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, bounciness: 6, useNativeDriver: true })
      ]).start();
    }
  }, [screenWidth, slideAnim, resetTransforms]);

  const animateResetZoom = useCallback(() => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setCurrentScale(1);
    panOffsetRef.current = { x: 0, y: 0 };
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }),
      Animated.spring(panAnim, { toValue: { x: 0, y: 0 }, useNativeDriver: true, bounciness: 4 }),
      Animated.timing(bgOpacityAnim, { toValue: 1, duration: 150, useNativeDriver: true })
    ]).start();
  }, [scaleAnim, panAnim, bgOpacityAnim]);

  const handleZoomStep = (delta: number) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const newScale = Math.max(0.8, Math.min(8.0, Number((currentScale + delta).toFixed(2))));
    if (newScale <= 1.0) {
      animateResetZoom();
    } else {
      setCurrentScale(newScale);
      Animated.spring(scaleAnim, {
        toValue: newScale,
        useNativeDriver: true,
        bounciness: 5
      }).start();
    }
  };

  const handleDoubleTap = useCallback((touchX: number, touchY: number) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    if (currentScaleRef.current > 1.2) {
      animateResetZoom();
    } else {
      const targetScale = 3.0;
      setCurrentScale(targetScale);
      const offsetX = (screenWidth / 2 - touchX) * 0.9;
      const offsetY = (screenHeight / 2 - touchY) * 0.9;
      panOffsetRef.current = { x: offsetX, y: offsetY };

      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: targetScale, useNativeDriver: true, bounciness: 6 }),
        Animated.spring(panAnim, { toValue: { x: offsetX, y: offsetY }, useNativeDriver: true, bounciness: 6 })
      ]).start();
    }
  }, [screenWidth, screenHeight, animateResetZoom, scaleAnim, panAnim]);

  const handleRotate = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setRotationDeg(prev => (prev + 90) % 360);
  };

  const handleFlip = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setIsFlippedX(prev => !prev);
  };

  const handleFullReset = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setRotationDeg(0);
    setIsFlippedX(false);
    animateResetZoom();
  };

  // PAN RESPONDER PRINCIPAL (Pinch-to-zoom 2 dedos, Pan 2D quando ampliado, Swipe Horizontal no Álbum, Swipe Down para fechar e Duplo Toque)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length >= 2,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length >= 2,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const t0 = touches[0];
          const t1 = touches[1];
          pinchStartDistRef.current = Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
          pinchStartScaleRef.current = currentScaleRef.current;
          pinchCenterRef.current = {
            x: (t0.pageX + t1.pageX) / 2,
            y: (t0.pageY + t1.pageY) / 2
          };
        } else {
          pinchStartDistRef.current = 0;
        }
      },

      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length >= 2) {
          // 1. PINCH-ZOOM MULTI-TOUCH COM 2 DEDOS (0.5x até 8.5x)
          const t0 = touches[0];
          const t1 = touches[1];
          const dist = Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);

          if (!pinchStartDistRef.current || pinchStartDistRef.current <= 0) {
            pinchStartDistRef.current = dist;
            pinchStartScaleRef.current = currentScaleRef.current;
            pinchCenterRef.current = {
              x: (t0.pageX + t1.pageX) / 2,
              y: (t0.pageY + t1.pageY) / 2
            };
          } else {
            const factor = dist / pinchStartDistRef.current;
            const newScale = Math.max(0.5, Math.min(8.5, pinchStartScaleRef.current * factor));
            scaleAnim.setValue(newScale);
            setCurrentScale(newScale);

            const curCenterX = (t0.pageX + t1.pageX) / 2;
            const curCenterY = (t0.pageY + t1.pageY) / 2;
            const centerDeltaX = curCenterX - pinchCenterRef.current.x;
            const centerDeltaY = curCenterY - pinchCenterRef.current.y;

            panAnim.setValue({
              x: panOffsetRef.current.x + centerDeltaX,
              y: panOffsetRef.current.y + centerDeltaY
            });
          }
        } else if (touches.length === 1) {
          if (currentScaleRef.current > 1.05) {
            // 2. PAN LIVRE 2D QUANDO AMPLIADO
            const maxPanX = (screenWidth * (currentScaleRef.current - 1)) / 1.5;
            const maxPanY = (screenHeight * (currentScaleRef.current - 1)) / 1.5;

            const rawX = panOffsetRef.current.x + gestureState.dx;
            const rawY = panOffsetRef.current.y + gestureState.dy;

            const boundedX = Math.max(-maxPanX, Math.min(maxPanX, rawX));
            const boundedY = Math.max(-maxPanY, Math.min(maxPanY, rawY));

            panAnim.setValue({ x: boundedX, y: boundedY });
          } else {
            // 3. EM 1.0x: ARRASTO HORIZONTAL NO ÁLBUM OU SWIPE DOWN PARA FECHAR
            if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
              // Arrasto Horizontal suave acompanhando o dedo em tempo real
              slideAnim.setValue(gestureState.dx);
            } else if (gestureState.dy > 0) {
              // Swipe Down para fechar
              panAnim.setValue({ x: 0, y: gestureState.dy });
              const dragProgress = Math.min(1, gestureState.dy / 250);
              bgOpacityAnim.setValue(Math.max(0.3, 1 - dragProgress * 0.7));
            }
          }
        }
      },

      onPanResponderRelease: (evt, gestureState) => {
        pinchStartDistRef.current = 0;

        // Caso A: Swipe Down Fechar
        if (currentScaleRef.current <= 1.05 && gestureState.dy > 110 && Math.abs(gestureState.dx) < 70) {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
          Animated.parallel([
            Animated.timing(panAnim, {
              toValue: { x: 0, y: screenHeight },
              duration: 180,
              useNativeDriver: true
            }),
            Animated.timing(bgOpacityAnim, {
              toValue: 0,
              duration: 180,
              useNativeDriver: true
            })
          ]).start(() => onClose());
          return;
        }

        // Caso B: ARRASTO HORIZONTAL PARA MUDAR DE FOTO (Swipe Esquerda / Direita)
        if (currentScaleRef.current <= 1.05 && Math.abs(gestureState.dx) > 40 && Math.abs(gestureState.dy) < 80) {
          if (gestureState.dx < -40) {
            // Puxou para a esquerda -> Próxima foto
            goToNextImage();
            return;
          } else if (gestureState.dx > 40) {
            // Puxou para a direita -> Foto anterior
            goToPrevImage();
            return;
          }
        }

        // Caso C: Reset Suave se não atingiu o threshold de troca
        if (currentScaleRef.current < 1.05) {
          panOffsetRef.current = { x: 0, y: 0 };
          setCurrentScale(1);
          Animated.parallel([
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }),
            Animated.spring(panAnim, { toValue: { x: 0, y: 0 }, useNativeDriver: true, bounciness: 4 }),
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
            Animated.timing(bgOpacityAnim, { toValue: 1, duration: 150, useNativeDriver: true })
          ]).start();
        } else {
          panOffsetRef.current = {
            x: (panAnim.x as any)._value || 0,
            y: (panAnim.y as any)._value || 0
          };
        }

        // Caso D: Toque Simples (Alternar HUD) vs Duplo Toque (Zoom 3x)
        const now = Date.now();
        const touchX = evt.nativeEvent.pageX;
        const touchY = evt.nativeEvent.pageY;

        if (Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8) {
          if (now - lastTapRef.current < 300) {
            if (singleTapTimerRef.current) {
              clearTimeout(singleTapTimerRef.current);
              singleTapTimerRef.current = null;
            }
            lastTapRef.current = 0;
            handleDoubleTap(touchX, touchY);
          } else {
            lastTapRef.current = now;
            singleTapTimerRef.current = setTimeout(() => {
              toggleHud();
              singleTapTimerRef.current = null;
            }, 300);
          }
        }
      }
    })
  ).current;

  // Salvar Foto na Galeria
  const handleSaveToGallery = async () => {
    if (!currentPhotoUri || isSaving) return;
    setIsSaving(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (Platform.OS === "web") {
        let downloadUrl = currentPhotoUri;
        try {
          if (currentPhotoUri.startsWith("http://") || currentPhotoUri.startsWith("https://")) {
            const res = await fetch(currentPhotoUri);
            if (res.ok) {
              const blob = await res.blob();
              downloadUrl = window.URL.createObjectURL(blob);
            }
          }
          const a = document.createElement("a");
          a.href = downloadUrl;
          a.download = `squirrel_foto_${Date.now()}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          showToast("Download da foto iniciado!");
        } catch {
          window.open(currentPhotoUri, "_blank");
        }
        setIsSaving(false);
        return;
      }

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        showToast("Permissão negada para salvar fotos.");
        setIsSaving(false);
        return;
      }

      let targetUri = currentPhotoUri;
      if (currentPhotoUri.startsWith("data:") || currentPhotoUri.startsWith("http://") || currentPhotoUri.startsWith("https://")) {
        const fileName = `squirrel_foto_${Date.now()}.jpg`;
        const tempPath = `${FileSystem.cacheDirectory}${fileName}`;
        if (currentPhotoUri.startsWith("data:")) {
          const base64Data = currentPhotoUri.split(",")[1] || currentPhotoUri;
          await FileSystem.writeAsStringAsync(tempPath, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else {
          const res = await FileSystem.downloadAsync(currentPhotoUri, tempPath);
          targetUri = res.uri;
        }
        targetUri = tempPath;
      }

      await MediaLibrary.saveToLibraryAsync(targetUri);
      if ((Platform.OS as string) !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      showToast("Foto salva na Galeria! 📸");
    } catch (err: any) {
      showToast(err?.message || "Erro ao salvar foto.");
    } finally {
      setIsSaving(false);
    }
  };

  // Compartilhar Foto
  const handleShare = async () => {
    if (!currentPhotoUri || isSharing) return;
    setIsSharing(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (Platform.OS === "web") {
        if (navigator.share) {
          await navigator.share({
            title: "Foto Squirrel",
            text: meta?.caption || "Foto do Squirrel",
            url: currentPhotoUri
          }).catch(() => {});
          setIsSharing(false);
          return;
        }
        await handleSaveToGallery();
        setIsSharing(false);
        return;
      }

      let targetUri = currentPhotoUri;
      if (currentPhotoUri.startsWith("data:") || currentPhotoUri.startsWith("http://") || currentPhotoUri.startsWith("https://")) {
        const fileName = `squirrel_share_${Date.now()}.jpg`;
        const tempPath = `${FileSystem.cacheDirectory}${fileName}`;
        if (currentPhotoUri.startsWith("data:")) {
          const base64Data = currentPhotoUri.split(",")[1] || currentPhotoUri;
          await FileSystem.writeAsStringAsync(tempPath, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else {
          const res = await FileSystem.downloadAsync(currentPhotoUri, tempPath);
          targetUri = res.uri;
        }
        targetUri = tempPath;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetUri, {
          mimeType: "image/jpeg",
          dialogTitle: "Compartilhar Foto"
        });
      } else {
        showToast("Compartilhamento indisponível.");
      }
    } catch (err: any) {
      showToast(err?.message || "Erro ao compartilhar.");
    } finally {
      setIsSharing(false);
    }
  };

  if (!visible || !currentPhotoUri) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden={!showHud} barStyle="light-content" backgroundColor="#000000" />

      {/* CONTAINER 100% PRETO AMOLED PURO */}
      <View className="flex-1 bg-black justify-center items-center relative select-none">
        
        {/* TOAST FLUTUANTE DE FEEDBACK */}
        {toastMessage && (
          <View className="absolute top-20 z-50 px-5 py-2.5 rounded-full bg-zinc-900/95 border border-zinc-700 shadow-2xl flex-row items-center gap-2">
            <Sparkles size={14} color="#38bdf8" />
            <Text className="text-xs font-bold text-white font-mono">{toastMessage}</Text>
          </View>
        )}

        {/* CONTAINER DA FOTO COM PAN, PINCH, ROTATE E SLIDE HORIZONTAL */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            transform: [
              { translateX: Animated.add(panAnim.x, slideAnim) },
              { translateY: panAnim.y },
              { scale: scaleAnim },
              { rotate: `${rotationDeg}deg` },
              { scaleX: isFlippedX ? -1 : 1 }
            ],
            opacity: bgOpacityAnim,
            width: screenWidth,
            height: screenHeight,
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          <Image
            source={{ uri: currentPhotoUri }}
            style={{
              width: screenWidth,
              height: screenHeight * 0.85
            }}
            resizeMode="contain"
          />
        </Animated.View>

        {/* BOTÕES LATERAIS DE NAVEGAÇÃO RÁPIDA (< e >) */}
        {photoList.length > 1 && showHud && currentScale <= 1.05 && (
          <>
            {currentIndex > 0 && (
              <Pressable
                onPress={goToPrevImage}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-40 h-12 w-12 rounded-full bg-black/80 border border-white/25 items-center justify-center active:scale-90 shadow-2xl"
                hitSlop={12}
              >
                <ChevronLeft size={24} color="#ffffff" strokeWidth={2.5} />
              </Pressable>
            )}

            {currentIndex < photoList.length - 1 && (
              <Pressable
                onPress={goToNextImage}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-40 h-12 w-12 rounded-full bg-black/80 border border-white/25 items-center justify-center active:scale-90 shadow-2xl"
                hitSlop={12}
              >
                <ChevronRight size={24} color="#ffffff" strokeWidth={2.5} />
              </Pressable>
            )}
          </>
        )}

        {/* BARRA SUPERIOR (HEADER HUD COM ESPAÇAMENTO AMPLO E RESPIRO) */}
        {showHud && (
          <SafeAreaView
            edges={["top"]}
            className="absolute top-0 left-0 right-0 z-50 bg-black/90 border-b border-zinc-850 px-4 py-3"
          >
            <View className="flex-row items-center justify-between">
              {/* Botão Fechar / Voltar */}
              <Pressable
                onPress={() => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-750 items-center justify-center active:scale-90 shadow-md"
                hitSlop={10}
              >
                <ChevronLeft size={20} color="#ffffff" strokeWidth={2.5} />
              </Pressable>

              {/* Informações do Remetente e Contador de Fotos */}
              <View className="flex-1 mx-3 items-center justify-center">
                <Text className="text-zinc-100 font-black text-xs uppercase tracking-wider truncate" numberOfLines={1}>
                  {meta?.senderName || meta?.senderUsername || "Foto"}
                </Text>
                {photoList.length > 1 ? (
                  <View className="mt-1 px-3 py-0.5 rounded-full bg-indigo-500/25 border border-indigo-500/40">
                    <Text className="text-[11px] font-mono text-indigo-300 font-black">
                      {currentIndex + 1} de {photoList.length}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    {meta?.timestamp ? new Date(meta.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Visualizador"}
                  </Text>
                )}
              </View>

              {/* Ações Rápidas (Espaçamento Amplo: Compartilhar e Salvar) */}
              <View className="flex-row items-center gap-3">
                {/* Compartilhar */}
                <Pressable
                  onPress={handleShare}
                  disabled={isSharing}
                  className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-750 items-center justify-center active:scale-90 shadow-md"
                  hitSlop={8}
                >
                  {isSharing ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Share2 size={18} color="#e4e4e7" strokeWidth={2} />
                  )}
                </Pressable>

                {/* Salvar na Galeria */}
                <Pressable
                  onPress={handleSaveToGallery}
                  disabled={isSaving}
                  className="h-10 px-3.5 rounded-full bg-zinc-100 border border-white flex-row items-center gap-1.5 active:scale-90 shadow-lg"
                  hitSlop={8}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#09090b" />
                  ) : (
                    <>
                      <Download size={16} color="#09090b" strokeWidth={2.5} />
                      <Text className="text-zinc-950 font-black text-xs uppercase tracking-wider">Salvar</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        )}

        {/* BARRA INFERIOR DE MANIPULAÇÃO COMPLETA */}
        {showHud && (
          <SafeAreaView
            edges={["bottom"]}
            className="absolute bottom-0 left-0 right-0 z-50 bg-black/85 border-t border-zinc-900/80 px-4 py-3"
          >
            {/* LEGENDA */}
            {meta?.caption ? (
              <View className="mb-2.5 px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800/80 max-w-[92%] self-center">
                <Text className="text-xs text-zinc-200 font-medium leading-relaxed text-center" numberOfLines={3}>
                  {meta.caption}
                </Text>
              </View>
            ) : null}

            {/* DOCK COMPLETO DE FERRAMENTAS DO VISUALIZADOR */}
            <View className="flex-row items-center justify-center gap-2">
              {/* Zoom Menos */}
              <Pressable
                onPress={() => handleZoomStep(-0.5)}
                className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800 active:scale-95"
                hitSlop={4}
              >
                <ZoomOut size={17} color="#d4d4d8" />
              </Pressable>

              {/* Indicador de % e Reset de Zoom */}
              <Pressable
                onPress={animateResetZoom}
                className={`h-10 px-3.5 rounded-xl border flex-row items-center gap-1.5 active:scale-95 ${
                  currentScale > 1.15 || rotationDeg !== 0 || isFlippedX
                    ? "bg-indigo-600/30 border-indigo-500/50"
                    : "bg-zinc-900 border-zinc-800"
                }`}
              >
                <Text className="text-xs font-mono font-black text-white">
                  {Math.round(currentScale * 100)}%
                </Text>
                {(currentScale > 1.15 || rotationDeg !== 0 || isFlippedX) && (
                  <RefreshCw size={11} color="#818cf8" />
                )}
              </Pressable>

              {/* Zoom Mais */}
              <Pressable
                onPress={() => handleZoomStep(0.5)}
                className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800 active:scale-95"
                hitSlop={4}
              >
                <ZoomIn size={17} color="#d4d4d8" />
              </Pressable>

              {/* Divisor */}
              <View className="h-6 w-[1px] bg-zinc-800 mx-1" />

              {/* Girar 90° */}
              <Pressable
                onPress={handleRotate}
                className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800 active:scale-95"
                hitSlop={4}
              >
                <RotateCw size={17} color="#d4d4d8" />
              </Pressable>

              {/* Espelhar Horizontal */}
              <Pressable
                onPress={handleFlip}
                className={`h-10 w-10 rounded-xl border items-center justify-center active:scale-95 ${
                  isFlippedX ? "bg-indigo-600/30 border-indigo-500/50" : "bg-zinc-900 border-zinc-800"
                }`}
                hitSlop={4}
              >
                <FlipHorizontal2 size={17} color={isFlippedX ? "#818cf8" : "#d4d4d8"} />
              </Pressable>

              {/* Reset Completo */}
              <Pressable
                onPress={handleFullReset}
                className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center active:bg-zinc-800 active:scale-95"
                hitSlop={4}
              >
                <Maximize2 size={16} color="#d4d4d8" />
              </Pressable>
            </View>
          </SafeAreaView>
        )}

      </View>
    </Modal>
  );
}
