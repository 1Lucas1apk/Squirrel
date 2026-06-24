import { ScrollView, Pressable, Text, View } from "react-native";

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
    <View className="mb-4">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
      >
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              className={`rounded-[20px] px-6 py-3.5 border-2 ${active ? "bg-zinc-100 border-zinc-100 shadow-xl" : "bg-ink-900 border-zinc-800"}`}
              onPress={() => onChange(tab.key)}
            >
              <Text
                className={`text-center text-[11px] font-black uppercase tracking-[2px] ${
                  active ? "text-zinc-950" : "text-zinc-500"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
