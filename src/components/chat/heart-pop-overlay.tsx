import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";

interface HeartPopOverlayProps {
  visible: boolean;
}

export function HeartPopOverlay({ visible }: HeartPopOverlayProps) {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.3);
      opacityAnim.setValue(0);
      translateYAnim.setValue(0);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.delay(350),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.spring(scaleAnim, {
            toValue: 1.4,
            friction: 4,
            tension: 50,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(translateYAnim, {
          toValue: -24,
          duration: 750,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View 
      pointerEvents="none" 
      className="absolute inset-0 items-center justify-center z-50 overflow-visible"
    >
      <Animated.View
        style={{
          opacity: opacityAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: translateYAnim },
          ],
        }}
      >
        <Text className="text-5xl shadow-2xl">❤️</Text>
      </Animated.View>
    </View>
  );
}
