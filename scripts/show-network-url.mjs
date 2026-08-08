import os from "node:os";

const port = String(process.env.PORT || "3000");
const addresses = [];

for (const entries of Object.values(os.networkInterfaces())) {
  for (const entry of entries || []) {
    if (entry.family !== "IPv4" || entry.internal) continue;
    if (!addresses.includes(entry.address)) addresses.push(entry.address);
  }
}

console.log("駿河屋価格トラッキングを共有閲覧できます。");
console.log(`メインPC: http://localhost:${port}`);

if (addresses.length === 0) {
  console.log("他端末用のIPv4アドレスを取得できませんでした。ipconfigでIPv4アドレスを確認してください。");
} else {
  console.log("他PC・スマホ（同じLAN / 接続可能なVPN）:");
  for (const address of addresses) {
    console.log(`  http://${address}:${port}`);
  }
}

console.log("初回にWindowsファイアウォールの確認が出た場合は、信頼できるプライベートネットワークだけ許可してください。");
