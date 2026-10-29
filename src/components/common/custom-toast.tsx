import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Pressable, Modal, Platform } from "react-native";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react-native";

export interface ToastConfig {
  id?: string;
  type?: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}

interface CustomToastProps {
  toast: ToastConfig | null;
  onDismiss: () => void;
}

export function CustomToast({ toast, onDismiss }: CustomToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (toast) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, toast.duration || 3000);

      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!toast) return null;

  const type = toast.type || "info";

  let Icon = Info;
  let borderColor = "border-blue-500/40";
  let bgColor = "bg-[#0d1527]/95";
  let iconColor = "#60a5fa";
  let textColor = "text-blue-200";

  if (type === "success") {
    Icon = CheckCircle2;
    borderColor = "border-emerald-500/40";
    bgColor = "bg-[#071c12]/95";
    iconColor = "#34d399";
    textColor = "text-emerald-200";
  } else if (type === "error") {
    Icon = AlertCircle;
    borderColor = "border-red-500/40";
    bgColor = "bg-[#200b0d]/95";
    iconColor = "#f87171";
    textColor = "text-red-200";
  } else if (type === "warning") {
    Icon = AlertTriangle;
    borderColor = "border-amber-500/40";
    bgColor = "bg-[#211706]/95";
    iconColor = "#fbbf24";
    textColor = "text-amber-200";
  }

  return (
    <View 
      style={{ 
        position: "absolute", 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 999999, 
        elevation: 999999,
        pointerEvents: "box-none"
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          top: Platform.OS === "android" ? 44 : 54,
          left: 16,
          right: 16,
          alignItems: "center",
          pointerEvents: "box-none",
          transform: [{ translateY }],
          opacity
        }}
      >
        <View
          pointerEvents="auto"
          className={`w-full ${bgColor} border ${borderColor} rounded-2xl p-3.5 shadow-2xl flex-row items-center justify-between gap-3`}
        >
          <View className="flex-row items-center gap-3 flex-1 min-w-0">
            <View className="h-9 w-9 rounded-xl bg-black/40 items-center justify-center flex-shrink-0">
              <Icon size={18} color={iconColor} strokeWidth={2.4} />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-xs font-black uppercase tracking-wider text-white truncate" numberOfLines={1}>
                {toast.title}
              </Text>
              {Boolean(toast.message) && (
                <Text className={`text-[10.5px] font-medium ${textColor} mt-0.5`} numberOfLines={2}>
                  {toast.message}
                </Text>
              )}
            </View>
          </View>

          <Pressable
            onPress={handleDismiss}
            hitSlop={8}
            className="h-7 w-7 rounded-lg bg-black/30 items-center justify-center active:bg-black/50 flex-shrink-0"
          >
            <X size={13} color="#a1a1aa" />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
