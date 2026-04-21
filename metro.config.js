const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Solução para o erro de resolução do Firebase Auth no React Native/Expo
// Força o Metro a usar a versão RN do Firebase em vez da versão Browser
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "firebase/auth" &&
    platform !== "web"
  ) {
    return {
      filePath: path.resolve(__dirname, "node_modules/@firebase/auth/dist/rn/index.js"),
      type: "sourceFile",
    };
  }
  
  // Delegar para o resolvedor padrão para outros módulos
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/styles/global.css" });
