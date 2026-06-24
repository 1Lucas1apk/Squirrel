import React, { useEffect, useState } from "react";
import { TextInput, TextInputProps } from "react-native";
import { useAppSettings } from "../../hooks/use-app-settings";

interface MoneyInputProps extends Omit<TextInputProps, "value" | "onChangeText"> {
  value: number;
  onChangeValue: (value: number) => void;
}

export function MoneyInput({ value, onChangeValue, ...props }: MoneyInputProps) {
  const [localValue, setLocalValue] = useState("");
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

  useEffect(() => {
    if (mode === "rtl") {
      setLocalValue(value === 0 ? "" : formatRTL(value));
    } else {
      setLocalValue((prev) => {
        const currentParsed = prev === "" ? 0 : parseManual(prev);
        if (currentParsed !== value) {
          if (value === 0) return "";
          return formatRTL(value);
        }
        return prev;
      });
    }
  }, [value, mode]);

  const handleChangeText = (text: string) => {
    if (!text) {
      setLocalValue("");
      onChangeValue(0);
      return;
    }

    if (mode === "rtl") {
      // Modo Nubank (Direita para Esquerda)
      const digits = text.replace(/\D/g, "");
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
      if (/\.\d{0,2}$/.test(normalizedText) && !normalizedText.includes(",")) {
        normalizedText = normalizedText.replace(/\./g, ",");
      } else {
        normalizedText = normalizedText.replace(/\./g, "");
      }

      let cleanText = normalizedText.replace(/[^\d,]/g, "");

      const parts = cleanText.split(",");
      if (parts.length > 2) {
        cleanText = parts[0] + "," + parts.slice(1).join("");
      }
      
      const finalParts = cleanText.split(",");
      if (finalParts.length === 2 && finalParts[1].length > 2) {
        cleanText = finalParts[0] + "," + finalParts[1].substring(0, 2);
      }
      
      const displayParts = cleanText.split(",");
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
      {...props}
      value={localValue}
      onChangeText={handleChangeText}
      keyboardType="decimal-pad"
      placeholder="0,00"
      placeholderTextColor="#27272a"
      cursorColor="#f4f4f5"
      selectionColor="#3f3f46"
    />
  );
}
