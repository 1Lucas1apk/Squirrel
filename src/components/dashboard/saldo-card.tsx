import { ReactNode } from "react";
import { Text, View } from "react-native";

interface SaldoCardProps {
  label: string;
  value: string;
  tone?: "default" | "purple" | "blue" | "yellow" | "green";
  icon?: ReactNode;
}

const toneClass: Record<NonNullable<SaldoCardProps["tone"]>, string> = {
  default: "border-zinc-800 bg-ink-900 shadow-sm",
  purple: "border-purple-600/20 bg-purple-500/5 shadow-purple-500/10",
  blue: "border-blue-600/20 bg-blue-500/5 shadow-blue-500/10",
  yellow: "border-yellow-500/20 bg-yellow-400/5 shadow-yellow-500/10",
  green: "border-emerald-600/20 bg-emerald-500/5 shadow-emerald-500/10",
};

const toneTextClass: Record<NonNullable<SaldoCardProps["tone"]>, string> = {
  default: "text-zinc-100",
  purple: "text-purple-300",
  blue: "text-blue-300",
  yellow: "text-yellow-200",
  green: "text-emerald-300",
};

export function SaldoCard({ label, value, tone = "default", icon }: SaldoCardProps) {
  return (
    <View className={`rounded-[32px] border px-6 py-7 shadow-2xl ${toneClass[tone]}`}>
      <View className="flex-row items-center gap-2 mb-2 opacity-60">
        {icon}
        <Text className={`text-[10px] font-black uppercase tracking-[2px] ${toneTextClass[tone]}`}>
          {label}
        </Text>
      </View>
      <Text 
        className={`text-[34px] font-black tracking-tighter ${toneTextClass[tone]}`}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}
