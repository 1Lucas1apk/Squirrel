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

// Dev Proxy para comunicação direta com o BackOffice UnBoxTech sem bloqueio de CORS no Web
const https = require("https");

// Sessão capturada dinamicamente em runtime (sem nenhum cookie hardcoded)
let capturedSessionCookie = "";

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware, server) => {
    return (req, res, next) => {
      const isUnboxProxy = req.url && req.url.startsWith("/unboxtech-proxy/");
      const isUnboxDirect = req.url && (req.url.startsWith("/UnBoxTech/") || req.url === "/UnBoxTech");

      if (isUnboxProxy || isUnboxDirect) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "*");
        res.setHeader("Access-Control-Expose-Headers", "set-cookie, x-set-cookie, location, *");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        const targetPath = isUnboxProxy
          ? req.url.replace(/^\/unboxtech-proxy/, "")
          : req.url;

        const isAuthRequest = targetPath.includes("/config/auth.php");

        // Coleta o corpo da requisição completamente antes de despachar
        const bodyChunks = [];
        req.on("data", (chunk) => bodyChunks.push(chunk));
        req.on("end", () => {
          const bodyBuffer = Buffer.concat(bodyChunks);

          const headers = { ...req.headers };
          delete headers["host"];
          delete headers["connection"];

          if (bodyBuffer.length > 0) {
            headers["content-length"] = bodyBuffer.length;
          } else if (req.method === "GET" || req.method === "HEAD") {
            delete headers["content-length"];
          }

          // Prioridade de sessão dinâmica:
          // IMPORTANTE: Em auth.php NÃO injetamos cookie antigo para não corromper o novo login
          if (!isAuthRequest) {
            if (req.headers["x-backoffice-cookie"]) {
              capturedSessionCookie = req.headers["x-backoffice-cookie"];
              headers["cookie"] = req.headers["x-backoffice-cookie"];
              delete headers["x-backoffice-cookie"];
            } else if (headers["cookie"] && headers["cookie"].includes("PHPSESSID")) {
              const match = headers["cookie"].match(/PHPSESSID=([^;]+)/);
              if (match) capturedSessionCookie = `PHPSESSID=${match[1]}`;
            } else if (capturedSessionCookie) {
              headers["cookie"] = capturedSessionCookie;
            }
          } else {
            // Requisição de login: limpa cookie enviado pelo navegador
            delete headers["cookie"];
            delete headers["x-backoffice-cookie"];
          }

          headers["host"] = "backoffice.unboxtech.com.br";
          headers["origin"] = "https://backoffice.unboxtech.com.br";
          if (targetPath.includes("/inadimplencia_loja/")) {
            headers["referer"] = "https://backoffice.unboxtech.com.br/UnBoxTech/modulos/inadimplencia_loja/index.php";
          } else if (targetPath.includes("/intranet/")) {
            headers["referer"] = "https://backoffice.unboxtech.com.br/UnBoxTech/modulos/intranet/index.php";
          } else {
            headers["referer"] = "https://backoffice.unboxtech.com.br/UnBoxTech/index.php";
          }

          const options = {
            hostname: "backoffice.unboxtech.com.br",
            port: 443,
            path: targetPath,
            method: req.method,
            headers,
          };

          const proxyReq = https.request(options, (proxyRes) => {
            const sc = proxyRes.headers["set-cookie"];
            const resHeaders = { ...proxyRes.headers };
            resHeaders["access-control-allow-origin"] = "*";
            resHeaders["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS";
            resHeaders["access-control-allow-headers"] = "*";
            resHeaders["access-control-expose-headers"] = "set-cookie, x-set-cookie, location, *";

            // Captura o ÚLTIMO PHPSESSID emitido (o PHP emite a sessão autenticada por último)
            let lastPhpSessId = null;
            if (sc) {
              const scList = Array.isArray(sc) ? sc : [sc];
              for (const c of scList) {
                const m = c.match(/PHPSESSID=([^;]+)/);
                if (m) lastPhpSessId = m[1];
              }
              if (lastPhpSessId) {
                capturedSessionCookie = `PHPSESSID=${lastPhpSessId}`;
              }
              const scStr = scList.join("; ");
              resHeaders["x-set-cookie"] = `PHPSESSID=${lastPhpSessId || ""}`;

              // Reescreve set-cookie para remover restrições de domínio e Secure no localhost
              const rewrittenCookies = scList.map((c) =>
                c.replace(/Domain=[^;]+;?\s*/gi, "").replace(/Secure;?\s*/gi, "").replace(/SameSite=[^;]+;?\s*/gi, "SameSite=Lax; ")
              );
              resHeaders["set-cookie"] = rewrittenCookies;
            }

            // Tratamento especial para tela de login (/config/auth.php):
            // Retorna JSON 200 OK para evitar que o navegador entre em 'opaqueredirect' e oculte o cookie
            if (isAuthRequest) {
              const loc = proxyRes.headers["location"] || "";
              const isSuccess = Boolean(lastPhpSessId && !loc.includes("erro"));

              if (isSuccess) {
                res.writeHead(200, {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                  "Access-Control-Allow-Headers": "*",
                  "Access-Control-Expose-Headers": "*",
                  "x-set-cookie": `PHPSESSID=${lastPhpSessId}`,
                });
                res.end(
                  JSON.stringify({
                    success: true,
                    cookie: `PHPSESSID=${lastPhpSessId}`,
                    location: loc,
                  })
                );
                return;
              } else {
                res.writeHead(401, {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                  "Access-Control-Allow-Headers": "*",
                  "Access-Control-Expose-Headers": "*",
                });
                res.end(
                  JSON.stringify({
                    success: false,
                    error: "Login ou senha incorretos",
                    location: loc,
                  })
                );
                return;
              }
            }

            // Reescreve cabeçalho Location para evitar que o navegador escape do proxy e entre em loop
            if (resHeaders["location"]) {
              const loc = resHeaders["location"];
              if (loc.startsWith("https://backoffice.unboxtech.com.br")) {
                resHeaders["location"] = loc.replace("https://backoffice.unboxtech.com.br", "/unboxtech-proxy");
              } else if (loc.startsWith("/")) {
                resHeaders["location"] = `/unboxtech-proxy${loc}`;
              }
            }

            res.writeHead(proxyRes.statusCode || 200, resHeaders);
            proxyRes.pipe(res);
          });

          proxyReq.on("error", (err) => {
            res.writeHead(502, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(JSON.stringify({ success: false, error: err.message }));
          });

          if (bodyBuffer.length > 0) {
            proxyReq.write(bodyBuffer);
          }
          proxyReq.end();
        });
        return;
      }
      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = withNativeWind(config, { input: "./src/styles/global.css" });
