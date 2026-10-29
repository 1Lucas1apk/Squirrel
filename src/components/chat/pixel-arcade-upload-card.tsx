import React, { useEffect, useRef } from "react";
import { View, Text, Image, Animated, Easing } from "react-native";

interface PixelArcadeUploadCardProps {
  imageUri: string;
  progress: number;
  phaseText?: string;
  isMural?: boolean;
}

export function PixelArcadeUploadCard({
  imageUri,
  progress,
  phaseText = "[1/3] ENVIANDO BYTES...",
  isMural = false,
}: PixelArcadeUploadCardProps) {
  const scanlineAnim = useRef(new Animated.Value(0)).current;
  const tailAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Scanline CRT Verde Laser
    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanlineAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanlineAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    // 2. Rabinho do Esquilinho Pixel Art
    const tailLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tailAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(tailAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Respiração do Mascote
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 0.94,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    scanLoop.start();
    tailLoop.start();
    breatheLoop.start();

    return () => {
      scanLoop.stop();
      tailLoop.stop();
      breatheLoop.stop();
    };
  }, []);

  const scanlineTranslateY = scanlineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 150],
  });

  const tailRotate = tailAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-12deg"],
  });

  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <View
      className={`mb-3 ${
        isMural ? "w-full" : "self-end max-w-[88%]"
      }`}
    >
      {/* Moldura Pixel Arcade 8-Bit */}
      <View className="bg-[#12141a] border-2 border-[#34d399] p-3 rounded-none relative shadow-xl">
        
        {/* Cantos Pixelados Decorativos */}
        <View className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-[#34d399]" />
        <View className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#34d399]" />
        <View className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-[#34d399]" />
        <View className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-[#34d399]" />

        {/* Header do Card Retrô */}
        <View className="flex-row items-center justify-between pb-1.5 mb-2 border-b border-dashed border-emerald-500/40">
          <Text className="text-[8.5px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
            [DRIVE_SYNC.EXE]
          </Text>
          <Text className="text-[8px] font-mono text-emerald-300 font-black">
            UPLOADING...
          </Text>
        </View>

        {/* Imagem com Scanline CRT e Mascote */}
        <View className="w-full h-40 bg-black rounded-none relative overflow-hidden border border-emerald-500/40">
          <Image
            source={{ uri: imageUri }}
            className="w-full h-full opacity-85"
            resizeMode="cover"
          />

          {/* Feixe Laser CRT Verde */}
          <Animated.View
            style={{
              transform: [{ translateY: scanlineTranslateY }],
            }}
            className="absolute left-0 right-0 h-1.5 bg-emerald-400 shadow-[0_0_12px_#34d399]"
          />

          {/* Mascote Esquilinho Pixel Art */}
          <View className="absolute bottom-2 left-2 bg-black/90 border border-emerald-400 px-2 py-0.5 flex-row items-center gap-1.5 shadow-lg">
            <Animated.View
              style={{
                transform: [
                  { scaleY: breatheAnim },
                  { rotate: tailRotate },
                ],
              }}
              className="flex-row items-center"
            >
              <Text className="text-xs">🐿️</Text>
            </Animated.View>
            <Text className="text-[8.5px] font-mono text-emerald-300 font-black">
              {clampedProgress}%
            </Text>
          </View>
        </View>

        {/* Barra de Blocos de Pixel */}
        <View className="mt-2.5">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-[8.5px] font-mono font-bold text-emerald-400 truncate flex-1 mr-2" numberOfLines={1}>
              {phaseText}
            </Text>
            <Text className="text-[9px] font-mono font-black text-emerald-400">
              {clampedProgress}%
            </Text>
          </View>

          {/* 20 Blocos Segmentados de Pixel Art */}
          <View className="w-full h-3.5 bg-black border border-emerald-500/50 p-0.5 flex-row gap-0.5">
            {Array.from({ length: 20 }).map((_, idx) => {
              const isFilled = (idx / 20) * 100 <= clampedProgress;
              return (
                <View
                  key={idx}
                  className={`flex-1 h-full ${
                    isFilled ? "bg-emerald-400" : "bg-emerald-950/40"
                  }`}
                />
              );
            })}
          </View>
        </View>

      </View>
    </View>
  );
}
