import { useCallback, useRef, useState } from "react";
import { RefreshControl } from "react-native";
import { colors } from "@/constants/theme";

/**
 * Standard pull-to-refresh for ScrollView / FlatList.
 * Pass `refreshControl={refreshControl}` onto the scrollable.
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, [onRefresh]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        void handleRefresh();
      }}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.white}
    />
  );

  return { refreshing, refreshControl, onRefresh: handleRefresh };
}
