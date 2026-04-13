import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MainScreen } from "./src/screens/main-screen";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <MainScreen />
    </SafeAreaProvider>
  );
}
