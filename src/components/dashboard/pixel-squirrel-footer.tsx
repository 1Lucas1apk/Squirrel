import React, { useEffect, useRef, memo } from "react";
import { View, Text, Animated, StyleSheet, Platform } from "react-native";

// Tamanho unitário do pixel = 2.4dp
const P = 2.4;

const styles = StyleSheet.create({
  container: {
    width: 32 * P,
    height: 32 * P,
    position: "relative",
  },
  // Rabo
  tailBlock1: { position: "absolute", left: 4 * P, top: 10 * P, width: 6 * P, height: 4 * P, backgroundColor: "#d97706" },
  tailBlock2: { position: "absolute", left: 2 * P, top: 14 * P, width: 8 * P, height: 6 * P, backgroundColor: "#f59e0b" },
  tailBlock3: { position: "absolute", left: 4 * P, top: 20 * P, width: 6 * P, height: 4 * P, backgroundColor: "#b45309" },
  tailBlock4: { position: "absolute", left: 6 * P, top: 8 * P, width: 4 * P, height: 2 * P, backgroundColor: "#fbbf24" },
  // Orelhas e Cabeça
  ear1: { position: "absolute", left: 18 * P, top: 6 * P, width: 3 * P, height: 4 * P, backgroundColor: "#b45309" },
  ear2: { position: "absolute", left: 19 * P, top: 7 * P, width: 1 * P, height: 2 * P, backgroundColor: "#fde68a" },
  ear3: { position: "absolute", left: 23 * P, top: 8 * P, width: 3 * P, height: 3 * P, backgroundColor: "#b45309" },
  head: { position: "absolute", left: 16 * P, top: 10 * P, width: 10 * P, height: 8 * P, backgroundColor: "#f59e0b" },
  eye: { position: "absolute", left: 20 * P, top: 12 * P, width: 2 * P, height: 2 * P, backgroundColor: "#18181b" },
  nose: { position: "absolute", left: 25 * P, top: 14 * P, width: 2 * P, height: 2 * P, backgroundColor: "#451a03" },
  cheek: { position: "absolute", left: 18 * P, top: 15 * P, width: 5 * P, height: 3 * P, backgroundColor: "#fef3c7" },
  // Tronco e Barriga
  body: { position: "absolute", left: 12 * P, top: 18 * P, width: 10 * P, height: 8 * P, backgroundColor: "#d97706" },
  belly: { position: "absolute", left: 14 * P, top: 19 * P, width: 6 * P, height: 6 * P, backgroundColor: "#fef3c7" },
  paw1: { position: "absolute", left: 12 * P, top: 26 * P, width: 4 * P, height: 2 * P, backgroundColor: "#b45309" },
  paw2: { position: "absolute", left: 18 * P, top: 26 * P, width: 4 * P, height: 2 * P, backgroundColor: "#b45309" },
  // Noz
  nut1: { position: "absolute", left: 22 * P, top: 18 * P, width: 4 * P, height: 4 * P, backgroundColor: "#f59e0b" },
  nut2: { position: "absolute", left: 23 * P, top: 17 * P, width: 2 * P, height: 1 * P, backgroundColor: "#78350f" },
  nut3: { position: "absolute", left: 23 * P, top: 19 * P, width: 2 * P, height: 2 * P, backgroundColor: "#fef08a" },
  // Grama
  ground: { position: "absolute", left: 0, top: 28 * P, width: 32 * P, height: 2 * P, backgroundColor: "#27272a" },
  grass1: { position: "absolute", left: 6 * P, top: 27 * P, width: 2 * P, height: 1 * P, backgroundColor: "#10b981" },
  grass2: { position: "absolute", left: 14 * P, top: 27 * P, width: 3 * P, height: 1 * P, backgroundColor: "#10b981" },
  grass3: { position: "absolute", left: 26 * P, top: 27 * P, width: 2 * P, height: 1 * P, backgroundColor: "#10b981" },
});

export const PixelSquirrelFooter = memo(function PixelSquirrelFooter({ operador }: { operador?: string }) {
  const tailAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;
  const nutAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animação do Rabinho (Balanço suave com native driver na GPU)
    const tailLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tailAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(tailAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    // Animação de Respiração do Corpinho
    const bodyLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bodyAnim, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(bodyAnim, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );

    // Animação da Noz de Ouro Flutuante
    const nutLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(nutAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(nutAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    tailLoop.start();
    bodyLoop.start();
    nutLoop.start();

    return () => {
      tailLoop.stop();
      bodyLoop.stop();
      nutLoop.stop();
    };
  }, [tailAnim, bodyAnim, nutAnim]);

  const tailRotation = tailAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-8deg"],
  });

  const tailTranslateY = tailAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  const bodyScaleY = bodyAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.94],
  });

  const nutTranslateY = nutAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  return (
    <View className="items-center justify-center pt-2 pb-1">
      {/* Contêiner de Pixel Art (Grid 32x32) */}
      <View style={styles.container}>
        
        {/* 1. RABINHO PIXEL ART ANIMADO */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { translateY: tailTranslateY },
                { rotate: tailRotation },
              ],
            },
          ]}
        >
          <View style={styles.tailBlock1} />
          <View style={styles.tailBlock2} />
          <View style={styles.tailBlock3} />
          <View style={styles.tailBlock4} />
        </Animated.View>

        {/* 2. CORPO E CABEÇA ANIMADOS */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ scaleY: bodyScaleY }],
            },
          ]}
        >
          {/* Orelhinhas */}
          <View style={styles.ear1} />
          <View style={styles.ear2} />
          <View style={styles.ear3} />

          {/* Cabeça */}
          <View style={styles.head} />
          <View style={styles.eye} />
          <View style={styles.nose} />
          <View style={styles.cheek} />

          {/* Tronco / Barriguinha */}
          <View style={styles.body} />
          <View style={styles.belly} />

          {/* Patinhas */}
          <View style={styles.paw1} />
          <View style={styles.paw2} />
        </Animated.View>

        {/* 3. NOZ DE OURO FLUTUANTE */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ translateY: nutTranslateY }],
            },
          ]}
        >
          <View style={styles.nut1} />
          <View style={styles.nut2} />
          <View style={styles.nut3} />
        </Animated.View>

        {/* 4. CHÃO DE GRAMINHA PIXELADA */}
        <View style={styles.ground} />
        <View style={styles.grass1} />
        <View style={styles.grass2} />
        <View style={styles.grass3} />

      </View>

      {/* TEXTO OFICIAL ABAIXO DO ESQUILO */}
      <View className="items-center mt-3">
        <Text className="text-[11px] font-black tracking-[3px] text-zinc-400 font-mono uppercase">
          SQUIRREL
        </Text>
        {operador ? (
          <Text className="text-[9px] font-bold tracking-[1.5px] text-zinc-500 uppercase mt-0.5">
            OPERADOR: {operador}
          </Text>
        ) : null}
      </View>
    </View>
  );
});
