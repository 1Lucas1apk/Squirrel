import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, ActivityIndicator } from "react-native";
import { MainScreen } from "./src/screens/main-screen";
import { LoginScreen } from "./src/screens/login-screen";
import { useAuth } from "./src/hooks/use-auth";

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 bg-ink-950 items-center justify-center">
        <ActivityIndicator color="#f4f4f5" size="large" />
      </View>
    );
  }

  return user ? <MainScreen /> : <LoginScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
