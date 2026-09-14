import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const colors = useTheme();
  return (
    <Tabs style={[styles.container, { backgroundColor: colors.background }]}>
      <TabSlot style={styles.slot} />

      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>

          <TabTrigger name="search" href="/search" asChild>
            <TabButton>Search</TabButton>
          </TabTrigger>

          <TabTrigger name="watchlist" href="/watchlist" asChild>
            <TabButton>Watchlist</TabButton>
          </TabTrigger>

          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton>Profile</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  ...props
}: TabTriggerSlotProps) {
  const colors = useTheme();
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <View style={[styles.tabButtonView, isFocused && { backgroundColor: colors.pressed }]}>
        <Text style={[styles.tabText, { color: colors.textSecondary }, isFocused && { color: colors.text }]}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const colors = useTheme();
  return (
    <View {...props} style={[styles.tabListContainer, {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
    }]}>
      <View style={styles.innerContainer}>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  slot: { flex: 1, minHeight: 0 },
  tabListContainer: {
    width: '100%',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: 800,
    gap: 4,
  },
  tabButton: { flex: 1, minWidth: 0 },
  tabText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 8,
    justifyContent: 'center',
  },
});
