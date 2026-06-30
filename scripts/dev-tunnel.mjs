/**
 * Startet Next.js (Port 3000) und einen Cloudflare-Quick-Tunnel (HTTPS).
 * Gibt die Meta-Webhook-Callback-URL in der Konsole aus.
 */
import { spawn } from "child_process"
import net from "net"

const PORT = Number(process.env.TUNNEL_PORT ?? 3000)
const WEBHOOK_PATH = "/api/webhooks/whatsapp"
const TUNNEL_URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i

let metaUrlPrinted = false

function printMetaCallbackUrl(baseUrl) {
  if (metaUrlPrinted) return
  metaUrlPrinted = true
  const callback = `${baseUrl.replace(/\/$/, "")}${WEBHOOK_PATH}`
  console.log("\n============================================================")
  console.log("  Öffentliche HTTPS-URL für Meta WhatsApp Webhook")
  console.log("============================================================")
  console.log(`  Callback-URL: ${callback}`)
  console.log("  Verify Token: Wert aus META_VERIFY_TOKEN in .env.local")
  console.log("============================================================\n")
}

function waitForPort(port, timeoutMs = 120_000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, "127.0.0.1")
      socket.once("connect", () => {
        socket.end()
        resolve()
      })
      socket.once("error", () => {
        socket.destroy()
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Port ${port} war nach ${timeoutMs / 1000}s nicht erreichbar.`))
          return
        }
        setTimeout(attempt, 500)
      })
    }
    attempt()
  })
}

function watchTunnelOutput(stream) {
  stream.on("data", (chunk) => {
    const text = chunk.toString()
    process.stderr.write(text)
    const match = text.match(TUNNEL_URL_RE)
    if (match) printMetaCallbackUrl(match[0])
  })
}

function killTree(child) {
  if (!child?.pid) return
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { shell: true })
  } else {
    child.kill("SIGTERM")
  }
}

console.log(`[dev:tunnel] Starte Next.js auf http://localhost:${PORT} …`)

const nextDev = spawn("npx", ["next", "dev", "-p", String(PORT)], {
  stdio: "inherit",
  shell: true,
})

nextDev.on("exit", (code) => {
  console.log(`[dev:tunnel] Next.js beendet (Code ${code ?? "?"}).`)
  process.exit(code ?? 0)
})

try {
  await waitForPort(PORT)
  console.log(`[dev:tunnel] Next.js bereit. Öffne HTTPS-Tunnel …`)

  const tunnel = spawn(
    "npx",
    ["--yes", "cloudflared", "tunnel", "--url", `http://localhost:${PORT}`],
    { stdio: ["inherit", "pipe", "pipe"], shell: true }
  )

  watchTunnelOutput(tunnel.stdout)
  watchTunnelOutput(tunnel.stderr)

  tunnel.on("exit", (code) => {
    console.log(`[dev:tunnel] Tunnel beendet (Code ${code ?? "?"}).`)
  })

  const shutdown = () => {
    console.log("\n[dev:tunnel] Beende Tunnel und Next.js …")
    killTree(tunnel)
    killTree(nextDev)
    process.exit(0)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
} catch (error) {
  console.error("[dev:tunnel] Fehler:", error instanceof Error ? error.message : error)
  killTree(nextDev)
  process.exit(1)
}
