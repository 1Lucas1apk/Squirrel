import React, { useEffect, useState, useRef } from "react";
import { TextInput, TextInputProps } from "react-native";
import { parseMoneyInput } from "../../utils/number";

interface MoneyInputProps extends Omit<TextInputProps, "value" | "onChangeText"> {
  value: number;
  onChangeValue: (value: number) => void;
}

export function MoneyInput({ value, onChangeValue, ...props }: MoneyInputProps) {
  const [localValue, setLocalValue] = useState("");
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const formatted = value === 0 ? "" : value.toFixed(2).replace(".", ",");
    setLocalValue(formatted);
  }, [value]);

  const handleChangeText = (text: string) => {
    const cleanText = text.replace(/[^0-9,.]/g, "");
    setLocalValue(cleanText);
    
    const parsed = parseMoneyInput(cleanText);
    isInternalChange.current = true;
    onChangeValue(parsed);
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
