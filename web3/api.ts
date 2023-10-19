const { ApiPromise, WsProvider } = require("@polkadot/api");

export async function subProvider(network) {
  const chains = {
    dancebox: {
      ws: "wss://fraa-dancebox-rpc.a.dancebox.tanssi.network",
    },
  };

  // Create WS Provider
  const wsProvider = new WsProvider(chains[network].ws);

  // Wait for Provider
  const api = await ApiPromise.create({
    provider: wsProvider,
    noInitWarn: true,
  });
  await api.isReady;
  return api;
}
