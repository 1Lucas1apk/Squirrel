import React, { useEffect, useState } from "react";
import { TextInput, TextInputProps } from "react-native";
import { useAppSettings } from "../../hooks/use-app-settings";

interface MoneyInputProps extends Omit<TextInputProps, "value" | "onChangeText"> {
  value: number;
  onChangeValue: (value: number) => void;
}

function MoneyInputComponent({ value, onChangeValue, ...props }: MoneyInputProps) {
  const { settings } = useAppSettings();
  const mode = settings.moneyInputMode || "rtl";

  const formatRTL = (val: number) => {
    if (val === 0) return "";
    const stringValue = val.toFixed(2);
    const [integerPart, decimalPart] = stringValue.split(".");
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formattedInteger},${decimalPart}`;
  };

  const parseManual = (text: string) => {
     let normalized = text.replace(/\./g, "");
     normalized = normalized.replace(/,/g, ".");
     const parsed = Number(normalized);
     return isNaN(parsed) ? 0 : parsed;
  };

  // Sincronização síncrona instantânea (0ms) sem useEffect lag
  const [prevValue, setPrevValue] = useState(value);
  const [prevMode, setPrevMode] = useState(mode);
  const [localValue, setLocalValue] = useState(() => (value === 0 ? "" : formatRTL(value)));

  if (prevValue !== value || prevMode !== mode) {
    setPrevValue(value);
    setPrevMode(mode);
    if (mode === "rtl") {
      setLocalValue(value === 0 ? "" : formatRTL(value));
    } else {
      const currentParsed = localValue === "" ? 0 : parseManual(localValue);
      if (currentParsed !== value) {
        setLocalValue(value === 0 ? "" : formatRTL(value));
      }
    }
  }

  const handleChangeText = (text: string) => {
    if (!text) {
      setLocalValue("");
      onChangeValue(0);
      return;
    }

    if (mode === "rtl") {
      // Modo Nubank (Direita para Esquerda) - Limita a 11 dígitos (máx R$ 999.999.999,99)
      const rawDigits = text.replace(/\D/g, "");
      const digits = rawDigits.slice(0, 11);
      if (!digits) {
        setLocalValue("");
        onChangeValue(0);
        return;
      }
      const numValue = parseInt(digits, 10) / 100;
      setLocalValue(formatRTL(numValue));
      onChangeValue(numValue);
    } else {
      // Modo Manual
      let normalizedText = text;

      // Se o usuário digitou um ponto no final (ex: teclado numérico no PC) e não há vírgula, assume que é vírgula decimal
      if (normalizedText.endsWith(".") && !normalizedText.includes(",")) {
        normalizedText = normalizedText.slice(0, -1) + ",";
      }

      // Removemos todos os pontos (separadores de milhar) para recalcular
      normalizedText = normalizedText.replace(/\./g, "");

      let cleanText = normalizedText.replace(/[^\d,]/g, "");

      const parts = cleanText.split(",");
      if (parts.length > 2) {
        cleanText = parts[0] + "," + parts.slice(1).join("");
      }
      
      const finalParts = cleanText.split(",");
      // Limita a parte inteira a 9 dígitos e decimais a 2
      finalParts[0] = (finalParts[0] || "").slice(0, 9);
      if (finalParts.length === 2 && finalParts[1].length > 2) {
        finalParts[1] = finalParts[1].substring(0, 2);
      }
      
      const displayParts = finalParts;
      displayParts[0] = displayParts[0]
        .replace(/^0+(?=\d)/, "")
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

      if (displayParts[0] === "" && displayParts.length === 2) {
        displayParts[0] = "0";
      }

      const finalString = displayParts.join(",");
      setLocalValue(finalString);

      const parsed = parseManual(finalString);
      onChangeValue(parsed);
    }
  };

  return (
    <TextInput
      placeholder="0,00"
      placeholderTextColor="#52525b"
      cursorColor="#f4f4f5"
      selectionColor="#3f3f46"
      maxLength={14}
      {...props}
      style={[{ paddingVertical: 0, paddingHorizontal: 0, includeFontPadding: false }, props.style]}
      value={localValue}
      onChangeText={handleChangeText}
      keyboardType="numeric"
    />
  );
}

export const MoneyInput = React.memo(MoneyInputComponent);
