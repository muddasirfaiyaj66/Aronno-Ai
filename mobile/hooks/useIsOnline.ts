import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

/** Shared online/offline flag (mirrors OfflineBanner NetInfo). */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    });
    void NetInfo.fetch().then((state) => {
      setOnline(state.isConnected !== false);
    });
    return unsub;
  }, []);

  return online;
}

export async function fetchIsOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected !== false;
}
