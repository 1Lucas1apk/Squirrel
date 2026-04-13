import { Pressable, Text, View } from "react-native";

export interface TabItem {
  key: string;
  label: string;
}

interface TabSwitcherProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function TabSwitcher({ tabs, activeKey, onChange }: TabSwitcherProps) {
  return (
    <View className="mb-4 flex-row rounded-xl border border-zinc-800 bg-ink-900 p-1">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            className={`flex-1 rounded-lg px-2 py-2 ${active ? "bg-zinc-100" : "bg-transparent"}`}
            onPress={() => onChange(tab.key)}
          >
            <Text
              className={`text-center text-xs font-semibold uppercase tracking-wide ${
                active ? "text-zinc-900" : "text-zinc-300"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
